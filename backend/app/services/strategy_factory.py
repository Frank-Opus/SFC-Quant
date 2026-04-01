import json
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from app.core.config import Settings
from app.models.analysis import AnalysisRunResult
from app.models.strategy import (
    StrategyArtifact,
    StrategyArtifactFile,
    StrategyFactoryConfigRequest,
    StrategyFactoryStatusResponse,
    StrategyGenerationRequest,
    StrategyGenerationResponse,
    StrategyProvider,
)
from app.services.analysis import AnalysisService
from app.services.event_bus import EventBus


class StrategyFactoryService:
    def __init__(
        self,
        *,
        settings: Settings,
        event_bus: EventBus,
        analysis_service: AnalysisService,
    ) -> None:
        self._event_bus = event_bus
        self._analysis_service = analysis_service
        self._enabled = settings.strategy_factory_enabled
        self._configured_provider = settings.strategy_factory_provider
        self._workspace = Path(settings.strategy_factory_workspace).expanduser().resolve()
        self._auto_generate = settings.strategy_factory_auto_generate

    async def initialize(self) -> None:
        self._workspace.mkdir(parents=True, exist_ok=True)

    def status(self) -> StrategyFactoryStatusResponse:
        artifacts = self.list_artifacts(limit=1)
        return StrategyFactoryStatusResponse(
            enabled=self._enabled,
            configured_provider=self._configured_provider,
            effective_provider=self._effective_provider(),
            workspace=str(self._workspace),
            auto_generate=self._auto_generate,
            reason=self._status_reason(),
            artifact_count=self._artifact_count(),
            latest_artifact=artifacts[0] if artifacts else None,
        )

    async def update_config(
        self,
        payload: StrategyFactoryConfigRequest,
    ) -> StrategyFactoryStatusResponse:
        if payload.enabled is not None:
            self._enabled = payload.enabled
        if payload.provider is not None and payload.provider.strip():
            self._configured_provider = payload.provider.strip().lower()
        if payload.auto_generate is not None:
            self._auto_generate = payload.auto_generate

        status = self.status()
        await self._event_bus.publish(
            event_type="strategy.factory.config.updated",
            source="strategy_factory",
            payload=status.model_dump(mode="json"),
        )
        return status

    def list_artifacts(
        self,
        *,
        symbol: str | None = None,
        timeframe: str | None = None,
        limit: int = 10,
    ) -> list[StrategyArtifact]:
        artifacts: list[StrategyArtifact] = []
        for manifest_path in sorted(self._workspace.glob("**/strategy.json"), reverse=True):
            try:
                artifact = StrategyArtifact.model_validate_json(manifest_path.read_text())
            except Exception:
                continue
            if symbol and artifact.symbol != symbol:
                continue
            if timeframe and artifact.timeframe != timeframe:
                continue
            artifacts.append(artifact)
            if len(artifacts) >= limit:
                break

        artifacts.sort(key=lambda item: item.created_at, reverse=True)
        return artifacts

    async def generate(
        self,
        payload: StrategyGenerationRequest,
    ) -> StrategyGenerationResponse:
        if not self._enabled:
            raise RuntimeError("Strategy Factory is disabled. Enable it before generating artifacts.")

        analysis = self._analysis_service.latest_analysis(
            symbol=payload.symbol,
            timeframe=payload.timeframe,
        )
        if analysis is None:
            raise LookupError(
                f"No latest analysis available for {payload.symbol} {payload.timeframe}. Run analysis first."
            )

        try:
            artifact = self._write_artifact(analysis=analysis, notes=payload.notes)
        except Exception as exc:
            await self._event_bus.publish(
                event_type="strategy.factory.failed",
                source="strategy_factory",
                payload={
                    "symbol": payload.symbol,
                    "timeframe": payload.timeframe,
                    "reason": str(exc),
                },
            )
            raise

        await self._event_bus.publish(
            event_type="strategy.factory.generated",
            source="strategy_factory",
            payload=artifact.model_dump(mode="json"),
        )
        return StrategyGenerationResponse(
            message=(
                f"Generated review artifact for {artifact.symbol} {artifact.timeframe} using {artifact.effective_provider}."
            ),
            artifact=artifact,
            status=self.status(),
        )

    def _artifact_count(self) -> int:
        return sum(1 for _ in self._workspace.glob("**/strategy.json"))

    def _effective_provider(self) -> StrategyProvider:
        if self._configured_provider == "mock_rdq":
            return "mock_rdq"
        if self._configured_provider == "rd_agent_q":
            return "mock_rdq"
        if self._configured_provider == "external":
            return "mock_rdq"
        return "mock_rdq"

    def _status_reason(self) -> str:
        if not self._enabled:
            return "Strategy Factory is disabled. Enable it to write reviewable strategy artifacts."
        if self._configured_provider == "mock_rdq":
            return "Local deterministic strategy generation is active; full RD-Agent(Q) integration remains optional."
        if self._configured_provider in {"rd_agent_q", "external"}:
            return (
                f"Configured provider '{self._configured_provider}' is not wired yet; local deterministic generation remains active."
            )
        return (
            f"Configured provider '{self._configured_provider}' is unsupported; local deterministic generation remains active."
        )

    def _write_artifact(
        self,
        *,
        analysis: AnalysisRunResult,
        notes: str | None,
    ) -> StrategyArtifact:
        created_at = datetime.now(timezone.utc)
        artifact_id = str(uuid4())
        directory_name = (
            f"{created_at.strftime('%Y%m%dT%H%M%SZ')}-"
            f"{analysis.symbol.lower().replace('/', '-').replace(':', '-')}-"
            f"{analysis.timeframe}"
        )
        artifact_dir = self._workspace / directory_name
        artifact_dir.mkdir(parents=True, exist_ok=False)

        risk_output = analysis.outputs[-1] if analysis.outputs else None
        macro_output = next(
            (output for output in analysis.outputs if output.role == "news_geopolitics"),
            None,
        )
        macro_summary = (
            macro_output.macro_thesis.summary
            if macro_output and macro_output.macro_thesis is not None
            else macro_output.summary if macro_output else "Macro context unavailable."
        )
        summary = risk_output.summary if risk_output else "No strategy summary available."
        effective_provider = self._effective_provider()

        files = [
            StrategyArtifactFile(path=str(artifact_dir / "strategy.md"), kind="markdown"),
            StrategyArtifactFile(path=str(artifact_dir / "strategy.json"), kind="json"),
            StrategyArtifactFile(path=str(artifact_dir / "strategy.py"), kind="python"),
        ]
        artifact = StrategyArtifact(
            artifact_id=artifact_id,
            symbol=analysis.symbol,
            timeframe=analysis.timeframe,
            run_id=analysis.run_id,
            created_at=created_at,
            configured_provider=self._configured_provider,
            effective_provider=effective_provider,
            recommendation=analysis.overall_recommendation,
            summary=summary,
            directory=str(artifact_dir),
            files=files,
        )

        review_markdown = "\n".join(
            [
                f"# Strategy Review Artifact {artifact.artifact_id}",
                "",
                f"- Symbol: {analysis.symbol}",
                f"- Timeframe: {analysis.timeframe}",
                f"- Run ID: {analysis.run_id}",
                f"- Recommendation: {analysis.overall_recommendation}",
                f"- Configured provider: {self._configured_provider}",
                f"- Effective provider: {effective_provider}",
                "",
                "## Risk Summary",
                summary,
                "",
                "## Macro Context",
                macro_summary,
                "",
                "## Role Snapshots",
                *[
                    f"- {output.role}: {output.summary} (confidence {output.confidence})"
                    for output in analysis.outputs
                ],
                "",
                "## Operator Notes",
                notes or "None provided.",
                "",
                "## Adoption Gate",
                "Review this artifact before wiring any logic into runtime execution.",
            ]
        )
        (artifact_dir / "strategy.md").write_text(review_markdown)

        manifest_payload = {
            "artifact": artifact.model_dump(mode="json"),
            "notes": notes,
            "macro_summary": macro_summary,
            "outputs": [output.model_dump(mode="json") for output in analysis.outputs],
        }
        (artifact_dir / "strategy.json").write_text(json.dumps(manifest_payload["artifact"], indent=2))

        strategy_stub = "\n".join(
            [
                '"""Review-only strategy scaffold generated by dSFC-Quant Phase 8."""',
                "",
                f"SYMBOL = {analysis.symbol!r}",
                f"TIMEFRAME = {analysis.timeframe!r}",
                f"RUN_ID = {analysis.run_id!r}",
                f"RECOMMENDATION = {analysis.overall_recommendation!r}",
                "",
                "",
                "def describe_strategy() -> dict[str, str]:",
                "    return {",
                f"        'symbol': SYMBOL,",
                f"        'timeframe': TIMEFRAME,",
                f"        'recommendation': RECOMMENDATION,",
                f"        'summary': {summary!r},",
                f"        'macro_summary': {macro_summary!r},",
                "    }",
            ]
        )
        (artifact_dir / "strategy.py").write_text(strategy_stub)

        return artifact
