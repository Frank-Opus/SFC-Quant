from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.models.analysis import ActionRecommendation

StrategyProvider = Literal["mock_rdq", "rd_agent_q", "external"]
ArtifactFileKind = Literal["markdown", "json", "python"]


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


class StrategyFactoryStatusResponse(BaseModel):
    enabled: bool
    configured_provider: str
    effective_provider: StrategyProvider
    workspace: str
    auto_generate: bool = False
    reason: str | None = None
    artifact_count: int = 0
    latest_artifact: StrategyArtifact | None = None


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
