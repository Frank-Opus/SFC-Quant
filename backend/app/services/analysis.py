import time
from datetime import datetime, timezone
from typing import Iterable
from uuid import uuid4

from app.core.config import Settings
from app.models.analysis import (
    ActionRecommendation,
    AgentAnalysisResult,
    AgentRole,
    AnalysisRunRequest,
    AnalysisRunResult,
    AnalysisRunStatus,
    AnalysisTrigger,
    EvidencePoint,
    ProviderAnalysisDraft,
    SourceReference,
)
from app.models.market import MarketSnapshot
from app.services.event_bus import EventBus
from app.services.market import MarketRuntimeService
from app.services.providers import MockAIProvider, ProviderFactory

ROLE_SEQUENCE: tuple[AgentRole, ...] = (
    "data",
    "technical_analysis",
    "news_geopolitics",
    "risk_decision",
)


class AnalysisService:
    def __init__(
        self,
        *,
        settings: Settings,
        market_service: MarketRuntimeService,
        event_bus: EventBus,
        provider_factory: ProviderFactory,
    ) -> None:
        self._settings = settings
        self._market_service = market_service
        self._event_bus = event_bus
        self._provider_factory = provider_factory
        self._latest_runs: dict[str, AnalysisRunResult] = {}

    async def initialize(self) -> None:
        for event in reversed(self._event_bus.get_recent_events(limit=200)):
            if event.event_type != "agent.analysis.completed":
                continue
            try:
                run = AnalysisRunResult.model_validate(event.payload)
            except Exception:
                continue
            self._latest_runs[self._key(run.symbol, run.timeframe)] = run

    async def run_analysis(
        self,
        request: AnalysisRunRequest,
        *,
        trigger: AnalysisTrigger = "manual",
    ) -> AnalysisRunResult:
        market_snapshot = await self._market_service.ensure_snapshot(
            symbol=request.symbol,
            timeframe=request.timeframe,
        )
        started_at = datetime.now(timezone.utc)
        run_id = str(uuid4())
        await self._event_bus.publish(
            event_type="agent.analysis.requested",
            source="primoagent",
            payload={
                "run_id": run_id,
                "symbol": request.symbol,
                "timeframe": request.timeframe,
                "trigger": trigger,
                "requested_at": started_at.isoformat(),
            },
        )

        selection = self._provider_factory.resolve()
        if selection.fallback_reason:
            await self._event_bus.publish(
                event_type="system.warning",
                source="analysis",
                payload={
                    "message": selection.fallback_reason,
                    "provider": self._settings.ai_provider,
                },
            )

        outputs: list[AgentAnalysisResult] = []
        used_fallback = bool(selection.fallback_reason)
        for role in ROLE_SEQUENCE:
            output = await self._run_role(
                role=role,
                request=request,
                market_snapshot=market_snapshot,
                prior_outputs=outputs,
                configured_provider=selection.provider,
            )
            outputs.append(output)
            used_fallback = used_fallback or output.status == "fallback"

        completed_at = datetime.now(timezone.utc)
        overall_recommendation = outputs[-1].recommendation if outputs else "hold"
        run = AnalysisRunResult(
            run_id=run_id,
            symbol=request.symbol,
            timeframe=request.timeframe,
            trigger=trigger,
            status="fallback" if used_fallback else "completed",
            provider=self._settings.ai_provider,
            model=getattr(selection.provider, "model", "mock-primoagent-v1"),
            started_at=started_at,
            completed_at=completed_at,
            market_snapshot=market_snapshot,
            outputs=outputs,
            overall_recommendation=overall_recommendation,
        )
        self._latest_runs[self._key(request.symbol, request.timeframe)] = run
        await self._event_bus.publish(
            event_type="agent.analysis.completed",
            source="primoagent",
            payload=run.model_dump(mode="json"),
        )
        return run

    def latest_analysis(self, *, symbol: str, timeframe: str) -> AnalysisRunResult | None:
        return self._latest_runs.get(self._key(symbol, timeframe))

    async def _run_role(
        self,
        *,
        role: AgentRole,
        request: AnalysisRunRequest,
        market_snapshot: MarketSnapshot,
        prior_outputs: list[AgentAnalysisResult],
        configured_provider,
    ) -> AgentAnalysisResult:
        system_prompt = self._build_system_prompt(role)
        user_prompt = self._build_user_prompt(
            role=role,
            request=request,
            market_snapshot=market_snapshot,
            prior_outputs=prior_outputs,
        )

        started = time.perf_counter()
        provider = configured_provider
        status: AnalysisRunStatus = "completed"
        try:
            if isinstance(provider, MockAIProvider):
                draft = self._mock_output(role=role, market_snapshot=market_snapshot, prior_outputs=prior_outputs)
            else:
                draft = await provider.generate(
                    role=role,
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                )
        except Exception as exc:
            status = "fallback"
            await self._event_bus.publish(
                event_type="system.warning",
                source=f"analysis.{role}",
                payload={
                    "message": "Provider generation failed; using mock fallback for this role.",
                    "detail": str(exc),
                    "role": role,
                },
            )
            provider = MockAIProvider()
            draft = self._mock_output(role=role, market_snapshot=market_snapshot, prior_outputs=prior_outputs)

        latency_ms = int((time.perf_counter() - started) * 1000)
        result = AgentAnalysisResult(
            role=role,
            status=status,
            provider=provider.name,
            model=provider.model,
            generated_at=datetime.now(timezone.utc),
            latency_ms=latency_ms,
            **draft.model_dump(),
        )
        await self._event_bus.publish(
            event_type="agent.role.completed",
            source=f"primoagent.{role}",
            payload={
                "symbol": request.symbol,
                "timeframe": request.timeframe,
                "run_role": role,
                "output": result.model_dump(mode="json"),
            },
        )
        return result

    def _build_system_prompt(self, role: AgentRole) -> str:
        return (
            "You are one role inside a PrimoAgent trading workflow. "
            f"Current role: {role}. Respond with one JSON object only. "
            "Schema: signal_bias, recommendation, confidence, summary, rationale, evidence, sources. "
            "confidence must be between 0 and 1. rationale must contain 2-4 concise strings. "
            "evidence is a list of objects with label, detail, kind. sources is a list of objects with title, kind, optional url, optional note. "
            "Be explainable, conservative, and avoid hallucinating unavailable data."
        )

    def _build_user_prompt(
        self,
        *,
        role: AgentRole,
        request: AnalysisRunRequest,
        market_snapshot: MarketSnapshot,
        prior_outputs: Iterable[AgentAnalysisResult],
    ) -> str:
        lines = [
            f"symbol: {request.symbol}",
            f"timeframe: {request.timeframe}",
            f"last_price: {market_snapshot.last_price}",
            f"change_percent: {market_snapshot.change_percent}",
            f"volume_24h: {market_snapshot.volume_24h}",
            f"candle_count: {len(market_snapshot.candles)}",
            f"market_source: {market_snapshot.source}",
        ]
        if request.notes:
            lines.append(f"operator_notes: {request.notes}")
        if prior_outputs:
            lines.append("prior_outputs:")
            for output in prior_outputs:
                lines.append(
                    f"- {output.role}: bias={output.signal_bias}, recommendation={output.recommendation}, confidence={output.confidence}, summary={output.summary}"
                )
        role_guidance = {
            "data": "Focus on price, trend, and observable market-state quality.",
            "technical_analysis": "Focus on candle structure, momentum, and tactical setup.",
            "news_geopolitics": "Focus on macro/news risk context. If no source-linked news exists, say so explicitly.",
            "risk_decision": "Synthesize the earlier roles into a cautious trading recommendation.",
        }
        lines.append(f"role_guidance: {role_guidance[role]}")
        return "\n".join(lines)

    def _mock_output(
        self,
        *,
        role: AgentRole,
        market_snapshot: MarketSnapshot,
        prior_outputs: list[AgentAnalysisResult],
    ) -> ProviderAnalysisDraft:
        change = market_snapshot.change_percent
        abs_change = abs(change)
        confidence = round(min(0.86, 0.44 + abs_change / 10), 2)
        bias = _bias_from_change(change)
        recommendation: ActionRecommendation = _recommendation_from_bias(bias)
        trend_text = (
            "upward momentum" if change > 0.4 else "downward pressure" if change < -0.4 else "range-bound conditions"
        )
        candles = market_snapshot.candles
        recent_close = candles[-1].close if candles else market_snapshot.last_price
        average_close = (
            sum(candle.close for candle in candles) / len(candles)
            if candles
            else market_snapshot.last_price
        )
        relative_position = "above" if recent_close >= average_close else "below"

        if role == "data":
            return ProviderAnalysisDraft(
                signal_bias=bias,
                recommendation=recommendation,
                confidence=confidence,
                summary=(
                    f"Market data reads as {trend_text} with price {relative_position} the short sample mean."
                ),
                rationale=[
                    f"Price change is {change}% on the selected timeframe.",
                    f"Last trade price is {market_snapshot.last_price} from the {market_snapshot.source} feed.",
                    f"Observed 24h volume is {market_snapshot.volume_24h} across the current snapshot.",
                ],
                evidence=[
                    EvidencePoint(label="Last price", detail=str(market_snapshot.last_price), kind="market"),
                    EvidencePoint(label="Change", detail=f"{change}%", kind="market"),
                    EvidencePoint(label="Relative close", detail=f"Recent close is {relative_position} average close", kind="market"),
                ],
                sources=[
                    SourceReference(title="Normalized market snapshot", kind="internal", note="Phase 2 market backbone"),
                    SourceReference(title=market_snapshot.exchange_id, kind="exchange", note=market_snapshot.source),
                ],
            )

        if role == "technical_analysis":
            return ProviderAnalysisDraft(
                signal_bias=bias,
                recommendation=recommendation,
                confidence=min(0.92, round(confidence + 0.05, 2)),
                summary=f"Technical read is {bias} with candles showing {trend_text}.",
                rationale=[
                    f"Recent close sits {relative_position} the simple mean of the sampled candles.",
                    f"Candle sample size is {len(candles)} and volatility is inferred from a {abs_change}% move.",
                    "No indicator stack is loaded yet, so this is a structure-first technical read.",
                ],
                evidence=[
                    EvidencePoint(label="Candle count", detail=str(len(candles)), kind="technical"),
                    EvidencePoint(label="Sample average close", detail=str(round(average_close, 2)), kind="technical"),
                    EvidencePoint(label="Recent close", detail=str(round(recent_close, 2)), kind="technical"),
                ],
                sources=[
                    SourceReference(title="Phase 2 OHLCV snapshot", kind="internal", note="No external indicator engine yet"),
                ],
            )

        if role == "news_geopolitics":
            caution_bias = "cautious" if abs_change > 2 else "neutral"
            return ProviderAnalysisDraft(
                signal_bias=caution_bias,
                recommendation="wait" if abs_change > 2 else "hold",
                confidence=0.38,
                summary="No live news feed is integrated yet, so macro context remains a constrained placeholder.",
                rationale=[
                    "Phase 3 does not yet include source-linked news ingestion.",
                    "The workflow should explicitly surface missing macro evidence instead of fabricating headlines.",
                    "Risk weighting stays conservative until Phase 8 macro extensions land.",
                ],
                evidence=[
                    EvidencePoint(label="Macro coverage", detail="No external news provider attached", kind="macro"),
                    EvidencePoint(label="Policy", detail="Missing evidence downgrades conviction", kind="risk"),
                ],
                sources=[
                    SourceReference(title="Macro/news feed pending", kind="internal", note="Planned for Phase 8"),
                ],
            )

        decision = _synthesize_recommendation(prior_outputs or [])
        decision_bias = _bias_from_recommendation(decision)
        return ProviderAnalysisDraft(
            signal_bias=decision_bias,
            recommendation=decision,
            confidence=round(min(0.9, confidence), 2),
            summary=f"Risk decision recommends {decision} after combining market, technical, and macro confidence bands.",
            rationale=[
                f"Data and technical outputs currently lean toward {_summarize_prior_bias(prior_outputs)}.",
                "Macro/news coverage is incomplete, which caps conviction and favors conservative actions.",
                "The risk role keeps paper-trading posture front and center for Phase 3.",
            ],
            evidence=[
                EvidencePoint(label="Consensus", detail=_summarize_prior_bias(prior_outputs), kind="risk"),
                EvidencePoint(label="Macro gap", detail="News evidence not yet integrated", kind="risk"),
            ],
            sources=[
                SourceReference(title="PrimoAgent role outputs", kind="internal", note="Synthesized by risk role"),
            ],
        )

    @staticmethod
    def _key(symbol: str, timeframe: str) -> str:
        return f"{symbol}:{timeframe}"


def _bias_from_change(change: float) -> str:
    if change >= 0.75:
        return "bullish"
    if change <= -0.75:
        return "bearish"
    return "neutral"


def _recommendation_from_bias(bias: str) -> ActionRecommendation:
    if bias == "bullish":
        return "buy"
    if bias == "bearish":
        return "sell"
    return "hold"


def _synthesize_recommendation(outputs: list[AgentAnalysisResult]) -> ActionRecommendation:
    bullish = sum(output.signal_bias == "bullish" for output in outputs)
    bearish = sum(output.signal_bias == "bearish" for output in outputs)
    cautious = sum(output.signal_bias == "cautious" for output in outputs)
    if cautious:
        return "wait"
    if bullish > bearish:
        return "buy"
    if bearish > bullish:
        return "sell"
    return "hold"


def _bias_from_recommendation(recommendation: ActionRecommendation) -> str:
    if recommendation == "buy":
        return "bullish"
    if recommendation == "sell":
        return "bearish"
    if recommendation == "wait":
        return "cautious"
    return "neutral"


def _summarize_prior_bias(outputs: list[AgentAnalysisResult]) -> str:
    if not outputs:
        return "no prior context"
    parts = [f"{output.role}:{output.signal_bias}" for output in outputs]
    return ", ".join(parts)
