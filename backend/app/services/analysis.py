import time
from datetime import datetime, timezone
from pathlib import Path
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
    MacroCatalyst,
    MacroThesis,
    MacroWatchItem,
    ProviderAnalysisDraft,
    SourceReference,
)
from app.models.events import EventEnvelope
from app.models.intelligence import IntelligenceSnapshotResponse
from app.models.market import MarketSnapshot
from app.services.event_bus import EventBus
from app.services.intelligence import ExternalIntelligenceService
from app.services.market import MarketRuntimeService
from app.services.providers import MockAIProvider, ProviderFactory
from app.services.run_ledger import RunLedgerService

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
        run_ledger: RunLedgerService,
        intelligence_service: ExternalIntelligenceService,
    ) -> None:
        self._settings = settings
        self._market_service = market_service
        self._event_bus = event_bus
        self._provider_factory = provider_factory
        self._run_ledger = run_ledger
        self._intelligence_service = intelligence_service
        self._latest_runs: dict[str, AnalysisRunResult] = {}

    @property
    def intelligence_service(self) -> ExternalIntelligenceService:
        return self._intelligence_service

    async def initialize(self) -> None:
        self._latest_runs = {}

        event_log_path = Path(self._event_bus.event_log_path)
        if event_log_path.exists():
            for line in event_log_path.read_text(encoding="utf-8").splitlines():
                if '"event_type": "agent.analysis.completed"' not in line:
                    continue
                try:
                    event = EventEnvelope.model_validate_json(line)
                    run = AnalysisRunResult.model_validate(event.payload)
                except Exception:
                    continue
                self._latest_runs[self._key(run.symbol, run.timeframe)] = run

        if self._latest_runs:
            return

        for event in reversed(self._event_bus.get_recent_events(limit=5000)):
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
        external_intelligence = await self._intelligence_service.snapshot(
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
        self._run_ledger.append_stage(
            run_id=run_id,
            symbol=request.symbol,
            timeframe=request.timeframe,
            stage="analysis",
            status="running",
            detail="PrimoAgent analysis requested and waiting for role outputs.",
            actor=self._settings.ai_provider,
            generated_at=started_at,
            metadata={
                "trigger": trigger,
                "external_intelligence_status": external_intelligence.status,
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
                run_id=run_id,
                request=request,
                market_snapshot=market_snapshot,
                prior_outputs=outputs,
                configured_provider=selection.provider,
                external_intelligence=external_intelligence,
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
        self._run_ledger.append_stage(
            run_id=run_id,
            symbol=request.symbol,
            timeframe=request.timeframe,
            stage="analysis",
            status="degraded" if used_fallback else "completed",
            detail=(
                f"PrimoAgent completed with {overall_recommendation.upper()} recommendation."
            ),
            actor=run.model,
            generated_at=completed_at,
            metadata={
                "provider": run.provider,
                "external_intelligence_status": external_intelligence.status,
            },
        )
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
        run_id: str,
        request: AnalysisRunRequest,
        market_snapshot: MarketSnapshot,
        prior_outputs: list[AgentAnalysisResult],
        configured_provider,
        external_intelligence: IntelligenceSnapshotResponse,
    ) -> AgentAnalysisResult:
        system_prompt = self._build_system_prompt(role)
        user_prompt = self._build_user_prompt(
            role=role,
            request=request,
            market_snapshot=market_snapshot,
            prior_outputs=prior_outputs,
            external_intelligence=external_intelligence,
        )

        started = time.perf_counter()
        provider = configured_provider
        status: AnalysisRunStatus = "completed"
        try:
            if isinstance(provider, MockAIProvider):
                draft = self._mock_output(
                    role=role,
                    market_snapshot=market_snapshot,
                    prior_outputs=prior_outputs,
                    external_intelligence=external_intelligence,
                )
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
            draft = self._mock_output(
                role=role,
                market_snapshot=market_snapshot,
                prior_outputs=prior_outputs,
                external_intelligence=external_intelligence,
            )

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
        self._run_ledger.append_stage(
            run_id=run_id,
            symbol=request.symbol,
            timeframe=request.timeframe,
            stage="analysis",
            status="degraded" if status == "fallback" else "running",
            detail=f"{role} lane completed: {result.summary}",
            actor=result.provider,
            generated_at=result.generated_at,
            metadata={
                "role": role,
                "recommendation": result.recommendation,
                "external_intelligence_status": external_intelligence.status,
            },
        )
        return result

    def _build_system_prompt(self, role: AgentRole) -> str:
        return (
            "You are one role inside a PrimoAgent trading workflow. "
            f"Current role: {role}. Respond with one JSON object only. "
            "Schema: signal_bias, recommendation, confidence, summary, rationale, evidence, sources, optional macro_thesis. "
            "confidence must be between 0 and 1. rationale must contain 2-4 concise strings. "
            "evidence is a list of objects with label, detail, kind. sources is a list of objects with title, kind, optional url, optional note. "
            "macro_thesis is only required for the news_geopolitics role and contains regime, stance, summary, catalysts, watch_items. "
            "Be explainable, conservative, and avoid hallucinating unavailable data. "
            "If evidence is simulated or reference-only, say so explicitly in notes and rationale."
        )

    def _build_user_prompt(
        self,
        *,
        role: AgentRole,
        request: AnalysisRunRequest,
        market_snapshot: MarketSnapshot,
        prior_outputs: Iterable[AgentAnalysisResult],
        external_intelligence: IntelligenceSnapshotResponse,
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
            "news_geopolitics": (
                "Focus on macro/news risk context. Provide source-linked evidence, and if sources are reference-only or simulated, say so explicitly."
            ),
            "risk_decision": "Synthesize the earlier roles into a cautious trading recommendation.",
        }
        lines.append(f"role_guidance: {role_guidance[role]}")
        lines.append(self._intelligence_service.prompt_context(external_intelligence))
        return "\n".join(lines)

    def _mock_output(
        self,
        *,
        role: AgentRole,
        market_snapshot: MarketSnapshot,
        prior_outputs: list[AgentAnalysisResult],
        external_intelligence: IntelligenceSnapshotResponse,
    ) -> ProviderAnalysisDraft:
        change = market_snapshot.change_percent
        abs_change = abs(change)
        confidence = round(min(0.86, 0.44 + abs_change / 10), 2)
        bias = _bias_from_change(change)
        recommendation: ActionRecommendation = _recommendation_from_bias(bias)
        trend_text = (
            "upward momentum"
            if change > 0.4
            else "downward pressure"
            if change < -0.4
            else "range-bound conditions"
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
                    EvidencePoint(
                        label="Relative close",
                        detail=f"Recent close is {relative_position} average close",
                        kind="market",
                    ),
                ],
                sources=[
                    SourceReference(
                        title="Normalized market snapshot",
                        kind="internal",
                        note="Phase 2 market backbone",
                    ),
                    SourceReference(
                        title=market_snapshot.exchange_id,
                        kind="exchange",
                        note=market_snapshot.source,
                    ),
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
                    EvidencePoint(
                        label="Sample average close",
                        detail=str(round(average_close, 2)),
                        kind="technical",
                    ),
                    EvidencePoint(
                        label="Recent close",
                        detail=str(round(recent_close, 2)),
                        kind="technical",
                    ),
                ],
                sources=[
                    SourceReference(
                        title="Phase 2 OHLCV snapshot",
                        kind="internal",
                        note="No external indicator engine yet",
                    ),
                ],
            )

        if role == "news_geopolitics":
            macro_thesis = _build_mock_macro_thesis(
                market_snapshot,
                external_intelligence=external_intelligence,
            )
            caution_bias = macro_thesis.stance
            return ProviderAnalysisDraft(
                signal_bias=caution_bias,
                recommendation="wait" if caution_bias == "cautious" else "hold",
                confidence=0.58 if caution_bias != "cautious" else 0.49,
                summary=macro_thesis.summary,
                rationale=[
                    "Macro/news posture uses live external reference services when they are configured and reachable.",
                    "The system still treats these feeds as operator-auditable context instead of an unchecked auto-trading trigger.",
                    "When any provider is unavailable, the macro lane preserves uncertainty instead of inventing confidence.",
                ],
                evidence=_build_external_evidence(
                    market_snapshot,
                    external_intelligence=external_intelligence,
                ),
                sources=_build_external_sources(external_intelligence),
                macro_thesis=macro_thesis,
            )

        decision = _synthesize_recommendation(prior_outputs or [])
        decision_bias = _bias_from_recommendation(decision)
        macro_role = next(
            (output for output in prior_outputs if output.role == "news_geopolitics"),
            None,
        )
        macro_note = (
            macro_role.macro_thesis.summary
            if macro_role and macro_role.macro_thesis is not None
            else "Macro posture remains incomplete."
        )
        return ProviderAnalysisDraft(
            signal_bias=decision_bias,
            recommendation=decision,
            confidence=round(min(0.9, confidence), 2),
            summary=f"Risk decision recommends {decision} after combining market, technical, and macro confidence bands.",
            rationale=[
                f"Data and technical outputs currently lean toward {_summarize_prior_bias(prior_outputs)}.",
                macro_note,
                "The risk role keeps paper-trading posture front and center and only escalates when the multi-role stack is aligned.",
            ],
            evidence=[
                EvidencePoint(label="Consensus", detail=_summarize_prior_bias(prior_outputs), kind="risk"),
                EvidencePoint(
                    label="Macro posture",
                    detail=macro_note,
                    kind="risk",
                ),
            ],
            sources=[
                SourceReference(
                    title="PrimoAgent role outputs",
                    kind="internal",
                    note="Synthesized by risk role",
                ),
            ],
        )

    @staticmethod
    def _key(symbol: str, timeframe: str) -> str:
        return f"{symbol}:{timeframe}"


def _build_mock_macro_thesis(
    market_snapshot: MarketSnapshot,
    *,
    external_intelligence: IntelligenceSnapshotResponse,
) -> MacroThesis:
    change = market_snapshot.change_percent
    abs_change = abs(change)
    focus_metric = external_intelligence.crypto[0] if external_intelligence.crypto else None
    rate_10y = next((metric for metric in external_intelligence.macro if metric.key == "DGS10"), None)
    fed_funds = next((metric for metric in external_intelligence.macro if metric.key == "FEDFUNDS"), None)
    wti = external_intelligence.energy[0] if external_intelligence.energy else None
    headline = external_intelligence.headlines[0] if external_intelligence.headlines else None

    stance_score = 0
    if focus_metric and focus_metric.change_percent is not None:
        if focus_metric.change_percent >= 1:
            stance_score += 1
        elif focus_metric.change_percent <= -1:
            stance_score -= 1
    if rate_10y is not None:
        if rate_10y.value >= 4.5:
            stance_score -= 1
        elif rate_10y.value <= 4.0:
            stance_score += 1
    if wti is not None:
        if wti.value >= 100:
            stance_score -= 1
        elif wti.value <= 85:
            stance_score += 1

    if stance_score >= 2:
        stance = "bullish"
    elif stance_score <= -2:
        stance = "bearish"
    elif abs_change > 2 or stance_score == -1:
        stance = "cautious"
    else:
        stance = "neutral"

    regime = (
        "risk-on with macro support"
        if stance == "bullish"
        else "defensive macro tape"
        if stance in {"bearish", "cautious"}
        else "balanced cross-asset tape"
    )

    focus_text = (
        f"{focus_metric.label} is {focus_metric.value:.2f} USD with {focus_metric.change_percent:+.2f}% 24h change."
        if focus_metric and focus_metric.change_percent is not None
        else f"{market_snapshot.symbol} moved {change}% on the sampled window."
    )
    rate_text = (
        f"US 10Y sits near {rate_10y.value:.2f}% and Fed Funds is {fed_funds.value:.2f}%"
        if rate_10y and fed_funds
        else "Rates context remains incomplete"
    )
    energy_text = (
        f"WTI crude is trading near {wti.value:.2f} {wti.unit or ''}."
        if wti is not None
        else "Energy pricing context is unavailable."
    )
    headline_text = headline.title if headline else "No live crypto headline is currently available."

    summary = (
        f"{focus_text} {rate_text}; {energy_text} Latest headline: {headline_text}"
    )

    catalysts = [
        MacroCatalyst(
            label="Crypto reference tape",
            detail=focus_text,
            impact="bullish" if stance == "bullish" else "bearish" if stance == "bearish" else "neutral",
            horizon="intraday",
        ),
        MacroCatalyst(
            label="Rates and liquidity backdrop",
            detail=rate_text,
            impact="cautious" if rate_10y and rate_10y.value >= 4.5 else "neutral",
            horizon="macro",
        ),
        MacroCatalyst(
            label="Energy inflation pressure",
            detail=energy_text,
            impact="cautious" if wti and wti.value >= 100 else "neutral",
            horizon="swing",
        ),
    ]
    if headline is not None:
        catalysts.append(
            MacroCatalyst(
                label="Headline pressure",
                detail=headline.title,
                impact="cautious",
                horizon="intraday",
            )
        )

    watch_items = [
        MacroWatchItem(
            label="Rates repricing",
            trigger=(
                f"Watch US 10Y above 4.50% (current {rate_10y.value:.2f}%)."
                if rate_10y is not None
                else "Watch the next Treasury yield repricing."
            ),
            implication="Would tighten risk appetite and reduce crypto beta conviction.",
        ),
        MacroWatchItem(
            label="Energy shock",
            trigger=(
                f"Watch WTI above 100 {wti.unit or ''} (current {wti.value:.2f})."
                if wti is not None
                else "Watch for a new oil spike."
            ),
            implication="Would revive inflation pressure and harden macro risk-off behavior.",
        ),
        MacroWatchItem(
            label="Headline follow-through",
            trigger=headline_text,
            implication="Use the live headline tape as a confirmation layer before escalating size.",
        ),
    ]

    return MacroThesis(
        regime=regime,
        stance=stance,
        summary=summary,
        catalysts=catalysts,
        watch_items=watch_items,
    )


def _build_external_evidence(
    market_snapshot: MarketSnapshot,
    *,
    external_intelligence: IntelligenceSnapshotResponse,
) -> list[EvidencePoint]:
    evidence = [
        EvidencePoint(
            label="Market sensitivity",
            detail=(
                f"{market_snapshot.symbol} moved {market_snapshot.change_percent}% over the sampled window, so macro beta remains relevant to tactical positioning."
            ),
            kind="macro",
        )
    ]
    for metric in external_intelligence.macro[:2]:
        evidence.append(
            EvidencePoint(
                label=metric.label,
                detail=(
                    f"{metric.value:.2f}{(' ' + metric.unit) if metric.unit else ''} as of {metric.as_of.date().isoformat() if metric.as_of else 'latest'}"
                ),
                kind="macro",
            )
        )
    if external_intelligence.energy:
        metric = external_intelligence.energy[0]
        evidence.append(
            EvidencePoint(
                label=metric.label,
                detail=f"{metric.value:.2f}{(' ' + metric.unit) if metric.unit else ''}",
                kind="risk",
            )
        )
    if external_intelligence.headlines:
        evidence.append(
            EvidencePoint(
                label="Live headline",
                detail=external_intelligence.headlines[0].title,
                kind="news",
            )
        )
    if external_intelligence.warnings:
        evidence.append(
            EvidencePoint(
                label="Coverage gaps",
                detail=" | ".join(external_intelligence.warnings[:2]),
                kind="risk",
            )
        )
    return evidence


def _build_external_sources(
    external_intelligence: IntelligenceSnapshotResponse,
) -> list[SourceReference]:
    sources: list[SourceReference] = []
    if external_intelligence.crypto:
        sources.append(
            SourceReference(
                title="CoinGecko Crypto Tape",
                kind="macro",
                url="https://www.coingecko.com/",
                note="Live crypto reference pricing used for macro/news context.",
            )
        )
    if external_intelligence.macro:
        sources.append(
            SourceReference(
                title="FRED Macro Data",
                kind="macro",
                url="https://fred.stlouisfed.org/",
                note="Live rates and dollar context from FRED.",
            )
        )
    if external_intelligence.energy:
        sources.append(
            SourceReference(
                title="EIA Energy Data",
                kind="macro",
                url="https://www.eia.gov/opendata/",
                note="Live WTI pricing used as inflation/energy pressure context.",
            )
        )
    if external_intelligence.headlines:
        sources.append(
            SourceReference(
                title=external_intelligence.headlines[0].source,
                kind="news",
                url=external_intelligence.headlines[0].url,
                note=external_intelligence.headlines[0].title,
            )
        )
    if not any(source.title == "FRED Macro Data" for source in sources):
        sources.append(
            SourceReference(
                title="FRED Macro Data",
                kind="macro",
                url="https://fred.stlouisfed.org/",
                note="Fallback reference anchor for rates/liquidity context.",
            )
        )
    if not any(source.title == "Reuters Markets" for source in sources):
        sources.append(
            SourceReference(
                title="Reuters Markets",
                kind="news",
                url="https://www.reuters.com/markets/",
                note="Fallback reference news desk when live headline ingestion is unavailable.",
            )
        )
    sources.append(
        SourceReference(
            title="Local thesis synthesis",
            kind="internal",
            note=(
                f"External intelligence status: {external_intelligence.status}."
            ),
        )
    )
    return sources


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
