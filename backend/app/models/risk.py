from typing import Literal

from pydantic import BaseModel, Field

RiskHaltAction = Literal["halt", "clear"]


class RiskPolicy(BaseModel):
    max_position_notional_usd: float
    max_concurrent_trades: int
    daily_loss_limit_usd: float
    blocked_symbols: list[str] = Field(default_factory=list)
    require_agent_approval: bool = True
    min_approval_confidence: float = 0.55


class RiskPolicyUpdateRequest(BaseModel):
    max_position_notional_usd: float | None = None
    max_concurrent_trades: int | None = None
    daily_loss_limit_usd: float | None = None
    blocked_symbols: list[str] | None = None
    require_agent_approval: bool | None = None
    min_approval_confidence: float | None = None


class RiskHaltRequest(BaseModel):
    action: RiskHaltAction
    reason: str | None = None


class LiveModeRequest(BaseModel):
    enable: bool
    confirmation_text: str | None = None


class RiskStatusResponse(BaseModel):
    policy: RiskPolicy
    halted: bool
    halt_reason: str | None = None
    daily_realized_pnl: float
    live_mode_enabled: bool
    live_mode_reason: str | None = None


class RiskEvaluationResult(BaseModel):
    approved: bool
    should_halt: bool = False
    reasons: list[str] = Field(default_factory=list)
