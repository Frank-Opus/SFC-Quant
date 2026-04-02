from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.core.runtime import MarketDataRuntime, RuntimeSnapshot
from app.models.market import MarketSnapshot

EventType = Literal[
    "system.connected",
    "system.warning",
    "market.snapshot",
    "market.tick",
    "agent.analysis.requested",
    "agent.role.completed",
    "agent.analysis.completed",
    "execution.signal.approved",
    "execution.signal.skipped",
    "execution.signal.blocked",
    "execution.order.created",
    "execution.order.submitted",
    "execution.order.filled",
    "execution.engine.paused",
    "execution.engine.resumed",
    "execution.position.updated",
    "risk.policy.updated",
    "risk.approval.granted",
    "risk.approval.denied",
    "risk.halt.triggered",
    "risk.halt.cleared",
    "risk.live_mode.enabled",
    "risk.live_mode.disabled",
    "strategy.factory.config.updated",
    "strategy.factory.started",
    "strategy.factory.generated",
    "strategy.factory.failed",
]


class EventEnvelope(BaseModel):
    event_id: str
    event_type: EventType
    generated_at: datetime
    source: str = "backend"
    payload: dict[str, Any] = Field(default_factory=dict)


class MarketSnapshotResponse(BaseModel):
    generated_at: datetime
    runtime: RuntimeSnapshot
    market_data: MarketDataRuntime
    snapshots: list[MarketSnapshot] = Field(default_factory=list)
    recent_events: list[EventEnvelope] = Field(default_factory=list)
