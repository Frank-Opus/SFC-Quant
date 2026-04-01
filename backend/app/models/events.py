from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.core.runtime import RuntimeSnapshot
from app.models.market import MarketSnapshot

EventType = Literal[
    "system.connected",
    "system.warning",
    "market.snapshot",
    "market.tick",
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
    snapshots: list[MarketSnapshot] = Field(default_factory=list)
    recent_events: list[EventEnvelope] = Field(default_factory=list)
