from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.models.analysis import AnalysisRunResult

ExecutionAction = Literal["pause", "resume"]
ExecutionEngineStatus = Literal["running", "paused"]
ExecutionOrderSide = Literal["buy", "sell"]
ExecutionOrderStatus = Literal["created", "submitted", "filled", "skipped", "blocked"]


class ExecutionControlRequest(BaseModel):
    action: ExecutionAction
    reason: str | None = None


class ExecutionDispatchRequest(BaseModel):
    symbol: str
    timeframe: str = "1m"
    notes: str | None = None


class ExecutionOrder(BaseModel):
    order_id: str
    run_id: str
    symbol: str
    timeframe: str
    side: ExecutionOrderSide
    status: ExecutionOrderStatus
    quantity: float
    requested_notional: float
    fill_price: float | None = None
    fill_value: float | None = None
    fee_paid: float = 0.0
    adapter: str
    created_at: datetime
    filled_at: datetime | None = None
    rationale_summary: str


class PaperPosition(BaseModel):
    symbol: str
    quantity: float
    avg_entry_price: float
    market_price: float
    unrealized_pnl: float
    updated_at: datetime


class ExecutionStatusResponse(BaseModel):
    engine_status: ExecutionEngineStatus
    execution_mode: str
    adapter: str
    starting_balance: float
    cash_balance: float
    equity_estimate: float
    last_run_id: str | None = None
    paused_reason: str | None = None
    recent_orders: list[ExecutionOrder] = Field(default_factory=list)
    positions: list[PaperPosition] = Field(default_factory=list)


class ExecutionDispatchResult(BaseModel):
    engine_status: ExecutionEngineStatus
    message: str
    analysis: AnalysisRunResult
    order: ExecutionOrder | None = None
    status: ExecutionStatusResponse
