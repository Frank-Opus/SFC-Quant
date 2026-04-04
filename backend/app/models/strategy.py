from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.models.analysis import ActionRecommendation

StrategyProvider = Literal["mock_rdq", "rd_agent_q", "tradingagents_cn", "external"]
ArtifactFileKind = Literal["markdown", "json", "python", "text"]
StrategyGenerationLifecycle = Literal["idle", "running", "completed", "failed", "timeout"]
StrategyGenerationPhase = Literal[
    "idle",
    "preparing",
    "writing_artifacts",
    "invoking_provider",
    "collecting_artifacts",
    "completed",
    "failed",
    "timeout",
]
AgentLogLevel = Literal["info", "warning", "error"]
StrategyProviderAvailability = Literal["ready", "fallback", "unavailable"]
AgentRuntimeStatus = Literal[
    "disabled",
    "ready",
    "running",
    "completed",
    "failed",
    "timeout",
    "fallback",
    "unavailable",
]


class StrategyArtifactFile(BaseModel):
    path: str
    kind: ArtifactFileKind


class StrategyInvocationArtifact(BaseModel):
    label: str
    path: str
    kind: ArtifactFileKind
    exists: bool = True


class StrategyGenerationLogEntry(BaseModel):
    generated_at: datetime
    level: AgentLogLevel
    phase: StrategyGenerationPhase
    provider: StrategyProvider | None = None
    message: str


class StrategyProviderRun(BaseModel):
    provider: StrategyProvider
    label: str
    command: list[str] = Field(default_factory=list)
    status: Literal["completed", "failed", "timeout"]
    started_at: datetime | None = None
    completed_at: datetime | None = None
    returncode: int | None = None
    timeout_seconds: float | None = None
    detail: str | None = None
    artifacts: list[StrategyInvocationArtifact] = Field(default_factory=list)


class StrategyArtifact(BaseModel):
    artifact_id: str
    symbol: str
    timeframe: str
    run_id: str
    created_at: datetime
    configured_provider: str
    effective_provider: StrategyProvider
    recommendation: ActionRecommendation
    summary: str
    directory: str
    files: list[StrategyArtifactFile] = Field(default_factory=list)
    provider_run: StrategyProviderRun | None = None


class StrategyGenerationState(BaseModel):
    status: StrategyGenerationLifecycle = "idle"
    phase: StrategyGenerationPhase = "idle"
    symbol: str | None = None
    timeframe: str | None = None
    run_id: str | None = None
    active_provider: StrategyProvider | None = None
    provider_label: str | None = None
    artifact_directory: str | None = None
    started_at: datetime | None = None
    updated_at: datetime | None = None
    completed_at: datetime | None = None
    detail: str | None = None
    stdout_path: str | None = None
    stderr_path: str | None = None
    run_meta_path: str | None = None
    logs: list[StrategyGenerationLogEntry] = Field(default_factory=list)
    artifacts: list[StrategyInvocationArtifact] = Field(default_factory=list)


class StrategyProviderRuntime(BaseModel):
    provider: StrategyProvider
    label: str
    configured: bool
    effective: bool
    available: bool
    availability: StrategyProviderAvailability
    reason: str | None = None
    command: str | None = None
    timeout_seconds: float | None = None
    requires_docker: bool = False
    invocation_prefix: str | None = None


class StrategyFactoryStatusResponse(BaseModel):
    enabled: bool
    configured_provider: str
    effective_provider: StrategyProvider
    workspace: str
    auto_generate: bool = False
    reason: str | None = None
    artifact_count: int = 0
    latest_artifact: StrategyArtifact | None = None
    generation: StrategyGenerationState = Field(default_factory=StrategyGenerationState)
    providers: list[StrategyProviderRuntime] = Field(default_factory=list)


class StrategyFactoryConfigRequest(BaseModel):
    enabled: bool | None = None
    provider: str | None = None
    auto_generate: bool | None = None


class StrategyGenerationRequest(BaseModel):
    symbol: str
    timeframe: str = "1m"
    notes: str | None = None


class StrategyGenerationResponse(BaseModel):
    message: str
    artifact: StrategyArtifact
    status: StrategyFactoryStatusResponse


class AgentRuntimeRecord(BaseModel):
    agent_id: str
    category: Literal["strategy_factory"] = "strategy_factory"
    provider: StrategyProvider
    label: str
    enabled: bool
    configured: bool
    effective: bool
    available: bool
    status: AgentRuntimeStatus
    phase: StrategyGenerationPhase = "idle"
    symbol: str | None = None
    timeframe: str | None = None
    run_id: str | None = None
    detail: str | None = None
    workspace: str
    artifact_directory: str | None = None
    latest_artifact_directory: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    logs: list[StrategyGenerationLogEntry] = Field(default_factory=list)
    artifacts: list[StrategyInvocationArtifact] = Field(default_factory=list)


class AgentRuntimeSummaryResponse(BaseModel):
    generated_at: datetime
    strategy_factory_enabled: bool
    configured_provider: str
    effective_provider: StrategyProvider
    agents: list[AgentRuntimeRecord] = Field(default_factory=list)
