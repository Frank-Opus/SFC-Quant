from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.models.analysis import ActionRecommendation

StrategyProvider = Literal["mock_rdq", "rd_agent_q", "external"]
ArtifactFileKind = Literal["markdown", "json", "python", "text"]
StrategyGenerationLifecycle = Literal["idle", "running", "completed", "failed", "timeout"]


class StrategyArtifactFile(BaseModel):
    path: str
    kind: ArtifactFileKind


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


class StrategyGenerationState(BaseModel):
    status: StrategyGenerationLifecycle = "idle"
    symbol: str | None = None
    timeframe: str | None = None
    run_id: str | None = None
    artifact_directory: str | None = None
    started_at: datetime | None = None
    updated_at: datetime | None = None
    completed_at: datetime | None = None
    detail: str | None = None
    stdout_path: str | None = None
    stderr_path: str | None = None
    run_meta_path: str | None = None


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
