from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

RunLedgerStage = Literal["analysis", "strategy", "execution", "performance"]
RunLedgerStatus = Literal[
    "idle",
    "ready",
    "running",
    "blocked",
    "completed",
    "degraded",
    "failed",
]


class RunLedgerRecord(BaseModel):
    run_id: str
    symbol: str
    timeframe: str
    stage: RunLedgerStage
    status: RunLedgerStatus
    detail: str | None = None
    actor: str | None = None
    generated_at: datetime
    metadata: dict[str, str] = Field(default_factory=dict)
