from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

PerformanceMode = Literal["paper", "backtest"]
TradeOutcome = Literal["win", "loss", "flat"]


class EquityCurvePoint(BaseModel):
    timestamp: datetime
    equity: float
    cash_balance: float
    drawdown: float = 0.0
    drawdown_amount: float = 0.0


class PerformanceTrade(BaseModel):
    trade_id: str
    symbol: str
    timeframe: str
    opened_at: datetime
    closed_at: datetime
    quantity: float
    entry_price: float
    exit_price: float
    pnl: float
    pnl_percent: float
    fees_paid: float
    outcome: TradeOutcome
    run_id: str | None = None


class PerformanceReport(BaseModel):
    mode: PerformanceMode
    symbol: str | None = None
    timeframe: str | None = None
    source: str | None = None
    strategy: str | None = None
    starting_balance: float
    ending_balance: float
    total_return: float
    max_drawdown: float
    win_rate: float
    trade_count: int
    candle_count: int | None = None
    equity_curve: list[EquityCurvePoint] = Field(default_factory=list)
    trades: list[PerformanceTrade] = Field(default_factory=list)
    open_position_count: int = 0
    latest_run_id: str | None = None
    latest_trade: PerformanceTrade | None = None


class BacktestRunRequest(BaseModel):
    symbol: str | None = None
    timeframe: str | None = None
