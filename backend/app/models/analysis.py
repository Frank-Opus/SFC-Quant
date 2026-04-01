from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.models.market import MarketSnapshot

AgentRole = Literal[
    "data",
    "technical_analysis",
    "news_geopolitics",
    "risk_decision",
]
AnalysisTrigger = Literal["manual", "scheduled"]
SignalBias = Literal["bullish", "bearish", "neutral", "cautious"]
ActionRecommendation = Literal["buy", "sell", "hold", "reduce", "wait"]
SourceKind = Literal["market", "technical", "news", "macro", "risk", "internal"]
AgentOutputStatus = Literal["completed", "fallback"]
AnalysisRunStatus = Literal["completed", "fallback"]


class EvidencePoint(BaseModel):
    label: str
    detail: str
    kind: SourceKind


class SourceReference(BaseModel):
    title: str
    kind: Literal["exchange", "macro", "news", "internal", "provider"]
    url: str | None = None
    note: str | None = None


class ProviderAnalysisDraft(BaseModel):
    signal_bias: SignalBias
    recommendation: ActionRecommendation
    confidence: float = Field(ge=0.0, le=1.0)
    summary: str
    rationale: list[str] = Field(default_factory=list)
    evidence: list[EvidencePoint] = Field(default_factory=list)
    sources: list[SourceReference] = Field(default_factory=list)


class AgentAnalysisResult(ProviderAnalysisDraft):
    role: AgentRole
    status: AgentOutputStatus = "completed"
    provider: str
    model: str
    generated_at: datetime
    latency_ms: int | None = None


class AnalysisRunRequest(BaseModel):
    symbol: str
    timeframe: str = "1m"
    notes: str | None = None


class AnalysisRunResult(BaseModel):
    run_id: str
    symbol: str
    timeframe: str
    trigger: AnalysisTrigger
    status: AnalysisRunStatus
    provider: str
    model: str
    started_at: datetime
    completed_at: datetime
    market_snapshot: MarketSnapshot
    outputs: list[AgentAnalysisResult] = Field(default_factory=list)
    overall_recommendation: ActionRecommendation
