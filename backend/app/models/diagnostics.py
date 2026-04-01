from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.core.runtime import RuntimeSnapshot
from app.models.execution import ExecutionStatusResponse
from app.models.risk import RiskStatusResponse
from app.models.strategy import StrategyFactoryStatusResponse

HealthProbeStatus = Literal["ok", "degraded"]


class HealthCheck(BaseModel):
    name: str
    status: HealthProbeStatus
    detail: str


class HealthStatusResponse(BaseModel):
    service: str = "backend"
    status: HealthProbeStatus
    generated_at: datetime
    runtime: RuntimeSnapshot
    checks: list[HealthCheck] = Field(default_factory=list)


class DiagnosticsSummaryResponse(BaseModel):
    generated_at: datetime
    runtime: RuntimeSnapshot
    websocket_connections: int
    event_log_path: str
    recent_event_counts: dict[str, int] = Field(default_factory=dict)
    recent_warnings: list[str] = Field(default_factory=list)
    execution: ExecutionStatusResponse
    risk: RiskStatusResponse
    strategy: StrategyFactoryStatusResponse
