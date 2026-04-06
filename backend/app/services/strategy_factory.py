import asyncio
import json
import os
import shlex
import shutil
import subprocess
import threading
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from app.core.config import Settings
from app.core.strategy_providers import (
    configured_provider_root,
    provider_env_var,
    provider_repo_root,
    resolve_provider_repo,
    wrapper_script_path,
)
from app.models.analysis import AnalysisRunResult
from app.models.strategy import (
    AgentLogLevel,
    AgentRuntimeRecord,
    AgentRuntimeSummaryResponse,
    ArtifactFileKind,
    StrategyArtifact,
    StrategyArtifactFile,
    StrategyFactoryConfigRequest,
    StrategyFactoryStatusResponse,
    StrategyGenerationLogEntry,
    StrategyGenerationPhase,
    StrategyGenerationRequest,
    StrategyGenerationResponse,
    StrategyGenerationState,
    StrategyInvocationArtifact,
    StrategyProvider,
    StrategyProviderRun,
    StrategyProviderRuntime,
)
from app.services.analysis import AnalysisService
from app.services.event_bus import EventBus
from app.services.run_ledger import RunLedgerService

_UNSET = object()
_PROVIDER_ORDER: tuple[StrategyProvider, ...] = (
    "mock_rdq",
    "rd_agent_q",
    "tradingagents_cn",
    "external",
)
_MAX_GENERATION_LOGS = 24


@dataclass(frozen=True)
class ExternalProviderSpec:
    provider: StrategyProvider
    label: str
    command: str
    timeout_seconds: float
    artifact_prefix: str
    requires_docker: bool = False


class StrategyFactoryService:
    def __init__(
        self,
        *,
        settings: Settings,
        event_bus: EventBus,
        analysis_service: AnalysisService,
        run_ledger: RunLedgerService,
    ) -> None:
        self._event_bus = event_bus
        self._analysis_service = analysis_service
        self._run_ledger = run_ledger
        self._enabled = settings.strategy_factory_enabled
        self._configured_provider = settings.strategy_factory_provider
        self._workspace = Path(settings.strategy_factory_workspace).expanduser().resolve()
        self._auto_generate = settings.strategy_factory_auto_generate
        self._rd_agent_command = settings.strategy_factory_rd_agent_command.strip()
        self._rd_agent_timeout_seconds = settings.strategy_factory_rd_agent_timeout_seconds
        self._tradingagents_command = settings.strategy_factory_tradingagents_command.strip()
        self._tradingagents_timeout_seconds = settings.strategy_factory_tradingagents_timeout_seconds
        self._generation_lock = threading.Lock()
        self._generation_state = StrategyGenerationState()

    async def initialize(self) -> None:
        self._workspace.mkdir(parents=True, exist_ok=True)

    def status(self) -> StrategyFactoryStatusResponse:
        artifacts = self.list_artifacts(limit=1)
        with self._generation_lock:
            generation = self._generation_state.model_copy(deep=True)
        return StrategyFactoryStatusResponse(
            enabled=self._enabled,
            configured_provider=self._configured_provider,
            effective_provider=self._effective_provider(),
            workspace=str(self._workspace),
            auto_generate=self._auto_generate,
            reason=self._status_reason(),
            artifact_count=self._artifact_count(),
            latest_artifact=artifacts[0] if artifacts else None,
            generation=generation,
            providers=self._provider_runtimes(),
        )

    def agent_runtime(self) -> AgentRuntimeSummaryResponse:
        status = self.status()
        latest_by_provider = {
            artifact.effective_provider: artifact
            for artifact in self.list_artifacts(limit=12)
        }
        agents: list[AgentRuntimeRecord] = []
        generation = status.generation

        for provider_runtime in status.providers:
            latest_artifact = latest_by_provider.get(provider_runtime.provider)
            if not status.enabled:
                runtime_status = "disabled"
            elif generation.status == "running" and generation.active_provider == provider_runtime.provider:
                runtime_status = "running"
            elif generation.status == "completed" and generation.active_provider == provider_runtime.provider:
                runtime_status = "completed"
            elif generation.status == "failed" and generation.active_provider == provider_runtime.provider:
                runtime_status = "failed"
            elif generation.status == "timeout" and generation.active_provider == provider_runtime.provider:
                runtime_status = "timeout"
            elif not provider_runtime.available:
                runtime_status = "fallback" if provider_runtime.configured else "unavailable"
            else:
                runtime_status = "ready"

            agents.append(
                AgentRuntimeRecord(
                    agent_id=f"strategy_factory:{provider_runtime.provider}",
                    provider=provider_runtime.provider,
                    label=provider_runtime.label,
                    enabled=status.enabled,
                    configured=provider_runtime.configured,
                    effective=provider_runtime.effective,
                    available=provider_runtime.available,
                    status=runtime_status,
                    phase=(
                        generation.phase
                        if generation.active_provider == provider_runtime.provider
                        else "idle"
                    ),
                    symbol=(
                        generation.symbol
                        if generation.active_provider == provider_runtime.provider
                        else None
                    ),
                    timeframe=(
                        generation.timeframe
                        if generation.active_provider == provider_runtime.provider
                        else None
                    ),
                    run_id=(
                        generation.run_id
                        if generation.active_provider == provider_runtime.provider
                        else None
                    ),
                    detail=(
                        generation.detail
                        if generation.active_provider == provider_runtime.provider
                        else provider_runtime.reason
                    ),
                    workspace=str(self._workspace),
                    artifact_directory=(
                        generation.artifact_directory
                        if generation.active_provider == provider_runtime.provider
                        else None
                    ),
                    latest_artifact_directory=latest_artifact.directory if latest_artifact else None,
                    started_at=(
                        generation.started_at
                        if generation.active_provider == provider_runtime.provider
                        else None
                    ),
                    completed_at=(
                        generation.completed_at
                        if generation.active_provider == provider_runtime.provider
                        else latest_artifact.created_at if latest_artifact else None
                    ),
                    logs=(
                        generation.logs
                        if generation.active_provider == provider_runtime.provider
                        else []
                    ),
                    artifacts=(
                        generation.artifacts
                        if generation.active_provider == provider_runtime.provider
                        else (latest_artifact.provider_run.artifacts if latest_artifact and latest_artifact.provider_run else [])
                    ),
                )
            )

        return AgentRuntimeSummaryResponse(
            generated_at=datetime.now(timezone.utc),
            strategy_factory_enabled=status.enabled,
            configured_provider=status.configured_provider,
            effective_provider=status.effective_provider,
            agents=agents,
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
                artifact = StrategyArtifact.model_validate_json(
                    manifest_path.read_text(encoding="utf-8")
                )
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

        effective_provider = self._effective_provider()
        detail = self._provider_generation_detail(effective_provider)
        self._set_generation_state(
            status="running",
            phase="preparing",
            symbol=payload.symbol,
            timeframe=payload.timeframe,
            run_id=analysis.run_id,
            active_provider=effective_provider,
            provider_label=self._provider_label(effective_provider),
            artifact_directory=None,
            started_at=datetime.now(timezone.utc),
            completed_at=None,
            detail=detail,
            stdout_path=None,
            stderr_path=None,
            run_meta_path=None,
            logs=[],
            artifacts=[],
            append_log=("info", f"Starting strategy generation via {self._provider_label(effective_provider)}."),
        )
        await self._event_bus.publish(
            event_type="strategy.factory.started",
            source="strategy_factory",
            payload=self.status().model_dump(mode="json"),
        )

        try:
            artifact = await asyncio.to_thread(
                self._write_artifact,
                analysis=analysis,
                notes=payload.notes,
            )
        except Exception as exc:
            current_status = "timeout" if "timed out" in str(exc).lower() else "failed"
            current_phase = "timeout" if current_status == "timeout" else "failed"
            self._set_generation_state(
                status=current_status,
                phase=current_phase,
                completed_at=datetime.now(timezone.utc),
                detail=str(exc),
                append_log=("error", str(exc)),
            )
            await self._event_bus.publish(
                event_type="strategy.factory.failed",
                source="strategy_factory",
                payload={
                    "symbol": payload.symbol,
                    "timeframe": payload.timeframe,
                    "reason": str(exc),
                    "status": self.status().model_dump(mode="json"),
                },
            )
            raise

        final_detail = (
            self._provider_completion_detail(artifact.provider_run)
            if artifact.provider_run is not None
            else "Deterministic review artifact completed."
        )
        self._set_generation_state(
            status="completed",
            phase="completed",
            completed_at=datetime.now(timezone.utc),
            artifact_directory=artifact.directory,
            detail=final_detail,
            artifacts=self._artifact_refs_from_files(artifact.files),
            append_log=("info", final_detail),
        )
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

    def _set_generation_state(
        self,
        *,
        status: object = _UNSET,
        phase: object = _UNSET,
        symbol: object = _UNSET,
        timeframe: object = _UNSET,
        run_id: object = _UNSET,
        active_provider: object = _UNSET,
        provider_label: object = _UNSET,
        artifact_directory: object = _UNSET,
        started_at: object = _UNSET,
        completed_at: object = _UNSET,
        detail: object = _UNSET,
        stdout_path: object = _UNSET,
        stderr_path: object = _UNSET,
        run_meta_path: object = _UNSET,
        logs: object = _UNSET,
        artifacts: object = _UNSET,
        append_log: tuple[AgentLogLevel, str] | None = None,
    ) -> None:
        with self._generation_lock:
            current = self._generation_state
            next_status = current.status if status is _UNSET else status
            next_phase = current.phase if phase is _UNSET else phase
            next_provider = (
                current.active_provider if active_provider is _UNSET else active_provider
            )
            next_logs = current.logs if logs is _UNSET else list(logs)
            if append_log is not None:
                level, message = append_log
                next_logs = [
                    *next_logs,
                    StrategyGenerationLogEntry(
                        generated_at=datetime.now(timezone.utc),
                        level=level,
                        phase=next_phase,
                        provider=next_provider,
                        message=message,
                    ),
                ][-_MAX_GENERATION_LOGS:]
            next_artifacts = current.artifacts if artifacts is _UNSET else list(artifacts)
            self._generation_state = StrategyGenerationState(
                status=next_status,  # type: ignore[arg-type]
                phase=next_phase,  # type: ignore[arg-type]
                symbol=current.symbol if symbol is _UNSET else symbol,
                timeframe=current.timeframe if timeframe is _UNSET else timeframe,
                run_id=current.run_id if run_id is _UNSET else run_id,
                active_provider=next_provider,
                provider_label=(
                    current.provider_label if provider_label is _UNSET else provider_label
                ),
                artifact_directory=(
                    current.artifact_directory
                    if artifact_directory is _UNSET
                    else artifact_directory
                ),
                started_at=current.started_at if started_at is _UNSET else started_at,
                updated_at=datetime.now(timezone.utc),
                completed_at=(
                    current.completed_at if completed_at is _UNSET else completed_at
                ),
                detail=current.detail if detail is _UNSET else detail,
                stdout_path=(current.stdout_path if stdout_path is _UNSET else stdout_path),
                stderr_path=(current.stderr_path if stderr_path is _UNSET else stderr_path),
                run_meta_path=(
                    current.run_meta_path if run_meta_path is _UNSET else run_meta_path
                ),
                logs=next_logs,
                artifacts=next_artifacts,
            )
            generation_state = self._generation_state
        self._append_run_ledger(generation_state)

    def _append_run_ledger(self, generation_state: StrategyGenerationState) -> None:
        if (
            generation_state.run_id is None
            or generation_state.symbol is None
            or generation_state.timeframe is None
            or generation_state.phase == "idle"
        ):
            return
        self._run_ledger.append_stage(
            run_id=generation_state.run_id,
            symbol=generation_state.symbol,
            timeframe=generation_state.timeframe,
            stage="strategy",
            status=self._ledger_status_from_generation(generation_state.status),
            detail=generation_state.detail,
            actor=generation_state.provider_label or generation_state.active_provider,
            generated_at=generation_state.updated_at,
            metadata={"phase": generation_state.phase},
        )

    def _ledger_status_from_generation(self, status: str) -> str:
        mapping = {
            "idle": "ready",
            "running": "running",
            "completed": "completed",
            "failed": "failed",
            "timeout": "failed",
        }
        return mapping.get(status, "degraded")

    def _provider_specs(self) -> dict[StrategyProvider, ExternalProviderSpec]:
        return {
            "rd_agent_q": ExternalProviderSpec(
                provider="rd_agent_q",
                label="RD-Agent(Q)",
                command=self._rd_agent_command,
                timeout_seconds=self._rd_agent_timeout_seconds,
                artifact_prefix="rdagent",
                requires_docker=True,
            ),
            "tradingagents_cn": ExternalProviderSpec(
                provider="tradingagents_cn",
                label="TradingAgents-CN",
                command=self._tradingagents_command,
                timeout_seconds=self._tradingagents_timeout_seconds,
                artifact_prefix="tradingagents",
            ),
        }

    def _provider_label(self, provider: str) -> str:
        if provider == "mock_rdq":
            return "Deterministic Mock"
        if provider == "rd_agent_q":
            return "RD-Agent(Q)"
        if provider == "tradingagents_cn":
            return "TradingAgents-CN"
        if provider == "external":
            return "External (reserved)"
        return provider

    def _provider_runtimes(self) -> list[StrategyProviderRuntime]:
        effective_provider = self._effective_provider()
        runtimes: list[StrategyProviderRuntime] = []
        for provider in _PROVIDER_ORDER:
            runtimes.append(
                self._provider_runtime(
                    provider,
                    configured=(provider == self._configured_provider),
                    effective=(provider == effective_provider),
                )
            )
        return runtimes

    def _provider_runtime(
        self,
        provider: StrategyProvider,
        *,
        configured: bool,
        effective: bool,
    ) -> StrategyProviderRuntime:
        if provider == "mock_rdq":
            reason = (
                "Local deterministic strategy generation is active."
                if configured or effective
                else "Local deterministic fallback remains available."
            )
            return StrategyProviderRuntime(
                provider=provider,
                label=self._provider_label(provider),
                configured=configured,
                effective=effective,
                available=True,
                availability="ready" if configured or effective else "fallback",
                reason=reason,
            )

        if provider == "external":
            return StrategyProviderRuntime(
                provider=provider,
                label=self._provider_label(provider),
                configured=configured,
                effective=effective,
                available=False,
                availability="unavailable",
                reason=(
                    "Configured provider 'external' is reserved for future adapters; local deterministic generation remains active."
                ),
            )

        spec = self._provider_specs()[provider]
        unavailable_reason = self._external_provider_unavailable_reason(spec)
        return StrategyProviderRuntime(
            provider=provider,
            label=spec.label,
            configured=configured,
            effective=effective,
            available=unavailable_reason is None,
            availability=("ready" if unavailable_reason is None else "fallback"),
            reason=(
                self._external_provider_ready_reason(spec)
                if unavailable_reason is None
                else unavailable_reason
            ),
            command=spec.command,
            timeout_seconds=spec.timeout_seconds,
            requires_docker=spec.requires_docker,
            invocation_prefix=spec.artifact_prefix,
        )

    def _effective_provider(self) -> StrategyProvider:
        if self._configured_provider == "mock_rdq":
            return "mock_rdq"
        if self._configured_provider in self._provider_specs():
            spec = self._provider_specs()[self._configured_provider]  # type: ignore[index]
            return spec.provider if self._external_provider_is_available(spec) else "mock_rdq"
        if self._configured_provider == "external":
            return "mock_rdq"
        return "mock_rdq"

    def _status_reason(self) -> str:
        if not self._enabled:
            return "Strategy Factory is disabled. Enable it to write reviewable strategy artifacts."

        runtime = self._provider_runtime(
            self._configured_provider if self._configured_provider in _PROVIDER_ORDER else "mock_rdq",  # type: ignore[arg-type]
            configured=True,
            effective=self._effective_provider() == self._configured_provider,
        )
        return runtime.reason or "Strategy Factory runtime ready."

    def _provider_generation_detail(self, provider: StrategyProvider) -> str:
        if provider == "rd_agent_q":
            return "Preparing RD-Agent(Q) review artifact and invocation audit trail."
        if provider == "tradingagents_cn":
            return "Preparing TradingAgents-CN review artifact and invocation audit trail."
        return "Preparing deterministic review artifact."

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
        self._set_generation_state(
            status="running",
            phase="writing_artifacts",
            artifact_directory=str(artifact_dir),
            detail="Writing review artifact files.",
            append_log=("info", "Created artifact workspace and started base artifact write."),
        )

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
        (artifact_dir / "strategy.md").write_text(review_markdown, encoding="utf-8")

        (artifact_dir / "strategy.json").write_text(
            json.dumps(artifact.model_dump(mode="json"), indent=2),
            encoding="utf-8",
        )

        strategy_stub = "\n".join(
            [
                '"""Review-only strategy scaffold generated by dSFC-Quant strategy factory."""',
                "",
                f"SYMBOL = {analysis.symbol!r}",
                f"TIMEFRAME = {analysis.timeframe!r}",
                f"RUN_ID = {analysis.run_id!r}",
                f"RECOMMENDATION = {analysis.overall_recommendation!r}",
                "",
                "",
                "def describe_strategy() -> dict[str, str]:",
                "    return {",
                "        'symbol': SYMBOL,",
                "        'timeframe': TIMEFRAME,",
                "        'recommendation': RECOMMENDATION,",
                f"        'summary': {summary!r},",
                f"        'macro_summary': {macro_summary!r},",
                "    }",
            ]
        )
        (artifact_dir / "strategy.py").write_text(strategy_stub, encoding="utf-8")
        self._set_generation_state(
            artifacts=self._artifact_refs_from_files(files),
            append_log=("info", "Wrote strategy.md, strategy.json, and strategy.py."),
        )

        provider_run: StrategyProviderRun | None = None
        if effective_provider in self._provider_specs():
            self._set_generation_state(
                status="running",
                phase="invoking_provider",
                detail=f"Running {self._provider_label(effective_provider)} command.",
                append_log=(
                    "info",
                    f"Invoking external provider {self._provider_label(effective_provider)}.",
                ),
            )
            provider_run = self._run_external_provider(
                spec=self._provider_specs()[effective_provider],
                analysis=analysis,
                notes=notes,
                artifact_dir=artifact_dir,
                existing_files=files,
            )
            provider_files = [
                StrategyArtifactFile(path=item.path, kind=item.kind)
                for item in provider_run.artifacts
            ]
            files.extend(provider_files)
            artifact.files = files
            artifact.provider_run = provider_run
            artifact.summary = f"{summary} {self._provider_completion_detail(provider_run)}"
            self._set_generation_state(
                status="running",
                phase="collecting_artifacts",
                detail=f"Collecting {self._provider_label(effective_provider)} invocation artifacts.",
                artifacts=self._artifact_refs_from_files(files),
                append_log=("info", "Captured provider invocation logs and generated files."),
            )
        else:
            artifact.files = files

        (artifact_dir / "strategy.json").write_text(
            json.dumps(artifact.model_dump(mode="json"), indent=2),
            encoding="utf-8",
        )
        return artifact

    def _external_provider_is_available(self, spec: ExternalProviderSpec) -> bool:
        return self._external_provider_unavailable_reason(spec) is None

    def _external_provider_ready_reason(self, spec: ExternalProviderSpec) -> str:
        return (
            f"{spec.label} command is callable. Strategy generation will attempt the real provider and store invocation artifacts; "
            "provider-specific configuration may still be required."
        )

    def _external_provider_unavailable_reason(self, spec: ExternalProviderSpec) -> str | None:
        command = self._command_parts(spec.command)
        if command is None:
            return (
                f"Configured provider '{spec.provider}' is selected, but the command is empty or invalid. "
                "Set a runnable command or keep the deterministic mock fallback."
            )

        command_issue = self._command_issue(command)
        if command_issue is not None:
            return command_issue

        if self._external_provider_requires_docker(spec, command) and not self._rd_agent_has_docker_access():
            return (
                f"Configured provider '{spec.provider}' is selected, but Docker daemon access is unavailable in this runtime. "
                "Mount /var/run/docker.sock or set DOCKER_HOST for the backend container; local deterministic generation remains active."
            )

        repo_reason = self._provider_repo_unavailable_reason(spec, command)
        if repo_reason is not None:
            return repo_reason

        return None

    def _command_parts(self, command: str) -> list[str] | None:
        if not command:
            return None
        try:
            parts = shlex.split(command)
        except ValueError:
            return None
        return parts or None

    def _resolve_executable(self, executable: str) -> str | None:
        expanded = str(Path(executable).expanduser())
        if Path(expanded).exists():
            return expanded if os.access(expanded, os.X_OK) else None
        return shutil.which(executable)

    def _command_issue(self, command: list[str]) -> str | None:
        executable = command[0]
        resolved_executable = self._resolve_executable(executable)
        if resolved_executable is None:
            return (
                "Configured provider command is unavailable. Install the provider runtime or set the command explicitly; "
                "local deterministic generation remains active."
            )

        script_path = self._script_argument_path(command)
        if script_path is not None and not script_path.exists():
            return (
                f"Configured provider command references a missing script path: {script_path}. "
                "Fix the command or keep the deterministic fallback."
            )

        return None

    def _uses_repo_owned_wrapper(
        self,
        provider: StrategyProvider,
        command: list[str],
    ) -> bool:
        wrapper_path = wrapper_script_path(provider)
        for part in command[:2]:
            candidate = Path(part).expanduser()
            if candidate == wrapper_path:
                return True
            if candidate.exists() and candidate.resolve() == wrapper_path:
                return True
        return False

    def _provider_repo_unavailable_reason(
        self,
        spec: ExternalProviderSpec,
        command: list[str],
    ) -> str | None:
        if not self._uses_repo_owned_wrapper(spec.provider, command):
            return None

        resolved_repo = resolve_provider_repo(spec.provider)
        if resolved_repo is not None:
            return None

        configured_root = configured_provider_root(spec.provider)
        if configured_root is not None:
            return (
                f"Configured provider '{spec.provider}' is selected, but source repo was not found at {configured_root}. "
                f"Fix {provider_env_var(spec.provider)} or install the provider into {provider_repo_root(spec.provider)}; "
                "local deterministic generation remains active."
            )

        label = spec.label.lower()
        return (
            f"Configured provider '{spec.provider}' is selected, but repo-owned {label} source not found at {provider_repo_root(spec.provider)}. "
            f"Install the provider there or set {provider_env_var(spec.provider)}; local deterministic generation remains active."
        )

    def _script_argument_path(self, command: list[str]) -> Path | None:
        if len(command) < 2:
            return None

        executable_name = Path(command[0]).name.lower()
        if executable_name not in {"python", "python3", "python3.10", "python3.11", "bash", "sh", "zsh"}:
            return None

        candidate = Path(command[1]).expanduser()
        if candidate.suffix not in {".py", ".sh"} and not candidate.as_posix().startswith((".", "/")):
            return None
        return candidate

    def _external_provider_requires_docker(
        self,
        spec: ExternalProviderSpec,
        command: list[str],
    ) -> bool:
        if not spec.requires_docker:
            return False
        if self._uses_repo_owned_wrapper(spec.provider, command):
            return True
        executable_name = Path(command[0]).name.lower()
        return executable_name == "rdagent"

    def _rd_agent_has_docker_access(self) -> bool:
        docker_host = os.environ.get("DOCKER_HOST", "").strip()
        if docker_host:
            return True

        docker_socket = Path("/var/run/docker.sock")
        return docker_socket.exists() and os.access(docker_socket, os.R_OK | os.W_OK)

    def _run_external_provider(
        self,
        *,
        spec: ExternalProviderSpec,
        analysis: AnalysisRunResult,
        notes: str | None,
        artifact_dir: Path,
        existing_files: list[StrategyArtifactFile],
    ) -> StrategyProviderRun:
        stdout_path = artifact_dir / f"{spec.artifact_prefix}.stdout.log"
        stderr_path = artifact_dir / f"{spec.artifact_prefix}.stderr.log"
        run_meta_path = artifact_dir / f"{spec.artifact_prefix}.run.json"
        input_path = artifact_dir / f"{spec.artifact_prefix}.input.json"
        self._set_generation_state(
            status="running",
            phase="invoking_provider",
            artifact_directory=str(artifact_dir),
            detail=f"Running {spec.label} command.",
            stdout_path=str(stdout_path),
            stderr_path=str(stderr_path),
            run_meta_path=str(run_meta_path),
            append_log=("info", f"Prepared {spec.label} invocation files."),
        )

        input_payload = {
            "provider": spec.provider,
            "provider_label": spec.label,
            "symbol": analysis.symbol,
            "timeframe": analysis.timeframe,
            "run_id": analysis.run_id,
            "recommendation": analysis.overall_recommendation,
            "notes": notes,
            "outputs": [output.model_dump(mode="json") for output in analysis.outputs],
        }
        input_path.write_text(json.dumps(input_payload, indent=2), encoding="utf-8")

        unavailable_reason = self._external_provider_unavailable_reason(spec)
        if unavailable_reason is not None:
            raise RuntimeError(unavailable_reason)

        command = self._command_parts(spec.command)
        assert command is not None  # guarded by availability check above
        known_paths = {
            Path(item.path) for item in existing_files
        } | {stdout_path, stderr_path, run_meta_path, input_path}
        env = os.environ.copy()
        env.update(
            {
                "DSFC_AGENT_PROVIDER": spec.provider,
                "DSFC_AGENT_PROVIDER_LABEL": spec.label,
                "DSFC_STRATEGY_ARTIFACT_DIR": str(artifact_dir),
                "DSFC_STRATEGY_INPUT_JSON": str(input_path),
                "DSFC_STRATEGY_SUMMARY_JSON": str(artifact_dir / "strategy.json"),
                "DSFC_STRATEGY_NOTES": notes or "",
                "DSFC_ANALYSIS_SYMBOL": analysis.symbol,
                "DSFC_ANALYSIS_TIMEFRAME": analysis.timeframe,
                "DSFC_ANALYSIS_RUN_ID": analysis.run_id,
                "DSFC_PROVIDER_ARTIFACT_PREFIX": spec.artifact_prefix,
            }
        )
        started_at = datetime.now(timezone.utc)

        try:
            result = subprocess.run(
                command,
                cwd=artifact_dir,
                env=env,
                capture_output=True,
                text=True,
                timeout=spec.timeout_seconds,
                check=False,
            )
        except subprocess.TimeoutExpired as exc:
            stdout_path.write_text(exc.stdout or "", encoding="utf-8")
            stderr_path.write_text(exc.stderr or "", encoding="utf-8")
            completed_at = datetime.now(timezone.utc)
            artifacts = self._provider_artifacts(
                artifact_dir=artifact_dir,
                prefix=spec.artifact_prefix,
                known_paths=known_paths,
                base_paths=[input_path, stdout_path, stderr_path, run_meta_path],
            )
            run_meta_path.write_text(
                json.dumps(
                    {
                        "provider": spec.provider,
                        "label": spec.label,
                        "command": command,
                        "timeout_seconds": spec.timeout_seconds,
                        "status": "timeout",
                        "started_at": started_at.isoformat(),
                        "completed_at": completed_at.isoformat(),
                        "generated_files": [item.path for item in artifacts],
                    },
                    indent=2,
                ),
                encoding="utf-8",
            )
            self._set_generation_state(
                status="timeout",
                phase="timeout",
                completed_at=completed_at,
                detail=f"{spec.label} command timed out after {spec.timeout_seconds} seconds.",
                stdout_path=str(stdout_path),
                stderr_path=str(stderr_path),
                run_meta_path=str(run_meta_path),
                artifacts=artifacts,
                append_log=(
                    "error",
                    f"{spec.label} command timed out after {spec.timeout_seconds} seconds.",
                ),
            )
            raise RuntimeError(
                f"{spec.label} command timed out after {spec.timeout_seconds} seconds."
            ) from exc

        stdout_path.write_text(result.stdout or "", encoding="utf-8")
        stderr_path.write_text(result.stderr or "", encoding="utf-8")
        completed_at = datetime.now(timezone.utc)
        artifacts = self._provider_artifacts(
            artifact_dir=artifact_dir,
            prefix=spec.artifact_prefix,
            known_paths=known_paths,
            base_paths=[input_path, stdout_path, stderr_path, run_meta_path],
        )
        run_status = "completed" if result.returncode == 0 else "failed"
        run_meta_path.write_text(
            json.dumps(
                {
                    "provider": spec.provider,
                    "label": spec.label,
                    "command": command,
                    "returncode": result.returncode,
                    "timeout_seconds": spec.timeout_seconds,
                    "status": run_status,
                    "started_at": started_at.isoformat(),
                    "completed_at": completed_at.isoformat(),
                    "duration_ms": int((completed_at - started_at).total_seconds() * 1000),
                    "generated_files": [item.path for item in artifacts],
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        artifacts = self._provider_artifacts(
            artifact_dir=artifact_dir,
            prefix=spec.artifact_prefix,
            known_paths=known_paths,
            base_paths=[input_path, stdout_path, stderr_path, run_meta_path],
        )
        self._set_generation_state(
            status="completed" if result.returncode == 0 else "failed",
            phase="collecting_artifacts" if result.returncode == 0 else "failed",
            completed_at=completed_at,
            detail=(
                f"{spec.label} command completed successfully."
                if result.returncode == 0
                else f"{spec.label} command failed with exit code {result.returncode}."
            ),
            stdout_path=str(stdout_path),
            stderr_path=str(stderr_path),
            run_meta_path=str(run_meta_path),
            artifacts=artifacts,
            append_log=(
                "info" if result.returncode == 0 else "error",
                (
                    f"{spec.label} command completed successfully."
                    if result.returncode == 0
                    else f"{spec.label} command failed with exit code {result.returncode}."
                ),
            ),
        )

        if result.returncode != 0:
            raise RuntimeError(
                f"{spec.label} command failed with exit code {result.returncode}. See {stderr_path} for details."
            )

        return StrategyProviderRun(
            provider=spec.provider,
            label=spec.label,
            command=command,
            status="completed",
            started_at=started_at,
            completed_at=completed_at,
            returncode=result.returncode,
            timeout_seconds=spec.timeout_seconds,
            detail=f"{spec.label} command completed successfully.",
            artifacts=artifacts,
        )

    def _provider_completion_detail(self, provider_run: StrategyProviderRun) -> str:
        mode_args = {arg.strip().lower() for arg in provider_run.command[1:]}
        validation_mode = bool(mode_args & {"help", "--help", "version", "--version"})
        extra_artifact_count = max(len(provider_run.artifacts) - 4, 0)
        if validation_mode or extra_artifact_count == 0:
            return f"{provider_run.label} callable validation completed."
        return f"{provider_run.label} invocation completed successfully."

    def _provider_artifacts(
        self,
        *,
        artifact_dir: Path,
        prefix: str,
        known_paths: set[Path],
        base_paths: list[Path],
    ) -> list[StrategyInvocationArtifact]:
        artifacts = [
            StrategyInvocationArtifact(
                label=path.name,
                path=str(path),
                kind=self._infer_artifact_kind(path),
                exists=path.exists(),
            )
            for path in base_paths
        ]
        extra_paths = sorted(
            [
                path
                for path in artifact_dir.iterdir()
                if path.is_file() and path not in known_paths
            ],
            key=lambda item: item.name,
        )
        artifacts.extend(
            StrategyInvocationArtifact(
                label=path.name,
                path=str(path),
                kind=self._infer_artifact_kind(path),
                exists=True,
            )
            for path in extra_paths
        )
        return artifacts

    def _infer_artifact_kind(self, path: Path) -> ArtifactFileKind:
        suffix = path.suffix.lower()
        if suffix in {".md", ".markdown"}:
            return "markdown"
        if suffix == ".json":
            return "json"
        if suffix == ".py":
            return "python"
        return "text"

    def _artifact_refs_from_files(
        self,
        files: list[StrategyArtifactFile],
    ) -> list[StrategyInvocationArtifact]:
        return [
            StrategyInvocationArtifact(
                label=Path(item.path).name,
                path=item.path,
                kind=item.kind,
                exists=Path(item.path).exists(),
            )
            for item in files
        ]
