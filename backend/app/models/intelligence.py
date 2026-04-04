from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


IntelligenceStatus = Literal["ready", "partial", "unavailable"]


class IntelligenceSourceStatus(BaseModel):
    provider: Literal["coingecko", "fred", "eia", "finnhub"]
    configured: bool
    available: bool
    detail: str


class IntelligenceMetric(BaseModel):
    key: str
    label: str
    value: float
    unit: str | None = None
    change_percent: float | None = None
    as_of: datetime | None = None
    source: Literal["coingecko", "fred", "eia"]
    url: str | None = None


class IntelligenceHeadline(BaseModel):
    title: str
    source: str
    url: str
    published_at: datetime | None = None
    category: str


class IntelligenceSnapshotResponse(BaseModel):
    generated_at: datetime
    focus_symbol: str
    focus_timeframe: str
    status: IntelligenceStatus
    summary: str
    providers: list[IntelligenceSourceStatus] = Field(default_factory=list)
    crypto: list[IntelligenceMetric] = Field(default_factory=list)
    macro: list[IntelligenceMetric] = Field(default_factory=list)
    energy: list[IntelligenceMetric] = Field(default_factory=list)
    headlines: list[IntelligenceHeadline] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
