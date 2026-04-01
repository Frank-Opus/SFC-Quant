from datetime import datetime

from pydantic import BaseModel, Field


class Candle(BaseModel):
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float


class MarketSnapshot(BaseModel):
    symbol: str
    timeframe: str
    exchange_id: str
    source: str
    generated_at: datetime
    last_price: float
    change_percent: float
    volume_24h: float
    candles: list[Candle] = Field(default_factory=list)
