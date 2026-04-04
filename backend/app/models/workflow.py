from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.models.analysis import ActionRecommendation, AgentRole
from app.models.strategy import StrategyProvider

WorkflowStageKey = Literal[
    "market",
    "analysis",
    "strategy",
    "risk",
    "execution",
    "performance",
]
WorkflowStageStatus = Literal[
    "idle",
    "ready",
    "running",
    "blocked",
    "completed",
    "degraded",
    "failed",
]
WorkflowFactTone = Literal["neutral", "info", "positive", "warning", "danger"]
WorkflowNoticeSeverity = Literal["warning", "danger"]


class WorkflowFact(BaseModel):
    label: str
    value: str
    tone: WorkflowFactTone = "neutral"


class WorkflowStageState(BaseModel):
    key: WorkflowStageKey
    label: str
    status: WorkflowStageStatus
    detail: str | None = None
    updated_at: datetime | None = None
    run_id: str | None = None
    actor: str | None = None
    facts: list[WorkflowFact] = Field(default_factory=list)


class WorkflowRoleState(BaseModel):
    role: AgentRole
    label: str
    status: WorkflowStageStatus
    provider: str
    model: str
    recommendation: ActionRecommendation
    confidence: float
    summary: str
    generated_at: datetime
    run_id: str | None = None


class WorkflowProviderState(BaseModel):
    provider: StrategyProvider
    label: str
    status: WorkflowStageStatus
    availability: Literal["ready", "fallback", "unavailable"]
    configured: bool
    effective: bool
    phase: str
    detail: str | None = None
    command: str | None = None
    updated_at: datetime | None = None
    run_id: str | None = None
    artifact_count: int = 0


class WorkflowNotice(BaseModel):
    key: str
    title: str
    detail: str
    severity: WorkflowNoticeSeverity


class WorkflowSnapshotResponse(BaseModel):
    generated_at: datetime
    symbol: str
    timeframe: str
    current_run_id: str | None = None
    active_stage_key: WorkflowStageKey | None = None
    current_handoff: str | None = None
    execution_mode: str
    execution_adapter: str
    requested_market_source: str
    effective_market_source: str
    stages: dict[WorkflowStageKey, WorkflowStageState]
    roles: list[WorkflowRoleState] = Field(default_factory=list)
    providers: list[WorkflowProviderState] = Field(default_factory=list)
    notices: list[WorkflowNotice] = Field(default_factory=list)
