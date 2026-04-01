from collections.abc import Awaitable, Callable
from datetime import datetime, timezone

from app.core.config import Settings
from app.models.analysis import AnalysisRunResult
from app.models.execution import ExecutionOrder, ExecutionStatusResponse, PaperPosition
from app.models.risk import (
    LiveModeRequest,
    RiskEvaluationResult,
    RiskPolicy,
    RiskPolicyUpdateRequest,
    RiskStatusResponse,
)
from app.services.event_bus import EventBus

LIVE_MODE_CONFIRMATION = "ENABLE LIVE TRADING"


class RiskService:
    def __init__(
        self,
        *,
        settings: Settings,
        event_bus: EventBus,
        pause_execution: Callable[[str | None], Awaitable[ExecutionStatusResponse]],
    ) -> None:
        self._settings = settings
        self._event_bus = event_bus
        self._pause_execution = pause_execution
        self._policy = RiskPolicy(
            max_position_notional_usd=settings.risk_max_position_notional_usd,
            max_concurrent_trades=settings.risk_max_concurrent_trades,
            daily_loss_limit_usd=settings.risk_daily_loss_limit_usd,
            blocked_symbols=settings.risk_blocked_symbols,
            require_agent_approval=settings.risk_require_agent_approval,
            min_approval_confidence=settings.risk_min_approval_confidence,
        )
        self._halted = False
        self._halt_reason: str | None = None
        self._daily_realized_pnl = 0.0
        self._live_mode_enabled = False
        self._live_mode_reason: str | None = None

    async def initialize(self) -> None:
        return None

    def status(self) -> RiskStatusResponse:
        return RiskStatusResponse(
            policy=self._policy,
            halted=self._halted,
            halt_reason=self._halt_reason,
            daily_realized_pnl=round(self._daily_realized_pnl, 8),
            live_mode_enabled=self._live_mode_enabled,
            live_mode_reason=self._live_mode_reason,
        )

    async def update_policy(self, payload: RiskPolicyUpdateRequest) -> RiskStatusResponse:
        data = payload.model_dump(exclude_none=True)
        self._policy = self._policy.model_copy(update=data)
        await self._event_bus.publish(
            event_type="risk.policy.updated",
            source="risk",
            payload=self._policy.model_dump(mode="json"),
        )
        return self.status()

    async def set_halt(self, reason: str | None = None) -> RiskStatusResponse:
        self._halted = True
        self._halt_reason = reason or "Risk halt engaged."
        await self._pause_execution(self._halt_reason)
        await self._event_bus.publish(
            event_type="risk.halt.triggered",
            source="risk",
            payload={"reason": self._halt_reason},
        )
        return self.status()

    async def clear_halt(self) -> RiskStatusResponse:
        self._halted = False
        self._halt_reason = None
        await self._event_bus.publish(
            event_type="risk.halt.cleared",
            source="risk",
            payload={"message": "Risk halt cleared."},
        )
        return self.status()

    async def evaluate_pretrade(
        self,
        *,
        analysis: AnalysisRunResult,
        execution_status: ExecutionStatusResponse,
        requested_notional: float,
        current_position: PaperPosition | None,
    ) -> RiskEvaluationResult:
        policy_reasons: list[str] = []
        approval_reasons: list[str] = []

        if self._halted:
            policy_reasons.append(self._halt_reason or "Risk halt is active.")

        if analysis.symbol in self._policy.blocked_symbols:
            policy_reasons.append(f"Symbol {analysis.symbol} is blocked by risk policy.")

        if analysis.overall_recommendation == "buy":
            if requested_notional > self._policy.max_position_notional_usd:
                policy_reasons.append(
                    f"Requested notional {requested_notional} exceeds max position limit {self._policy.max_position_notional_usd}."
                )
            if (
                current_position is None
                and len(execution_status.positions) >= self._policy.max_concurrent_trades
            ):
                policy_reasons.append(
                    f"Max concurrent trades limit {self._policy.max_concurrent_trades} reached."
                )

        if self._daily_realized_pnl <= -self._policy.daily_loss_limit_usd:
            policy_reasons.append(
                f"Daily loss limit {self._policy.daily_loss_limit_usd} has been breached."
            )

        if self._policy.require_agent_approval:
            risk_output = analysis.outputs[-1] if analysis.outputs else None
            if risk_output is None or risk_output.role != "risk_decision":
                approval_reasons.append("Risk decision output is missing.")
            elif risk_output.status == "fallback":
                approval_reasons.append("Risk decision fallback cannot approve a trade.")
            elif risk_output.recommendation != analysis.overall_recommendation:
                approval_reasons.append("Risk decision recommendation does not match the executable action.")
            elif risk_output.confidence < self._policy.min_approval_confidence:
                approval_reasons.append(
                    f"Risk decision confidence {risk_output.confidence} is below threshold {self._policy.min_approval_confidence}."
                )

        if policy_reasons:
            reason = "; ".join(policy_reasons)
            await self.set_halt(reason)
            await self._event_bus.publish(
                event_type="risk.approval.denied",
                source="risk",
                payload={
                    "symbol": analysis.symbol,
                    "run_id": analysis.run_id,
                    "reasons": policy_reasons,
                    "category": "policy",
                },
            )
            return RiskEvaluationResult(
                approved=False,
                should_halt=True,
                reasons=policy_reasons,
            )

        if approval_reasons:
            await self._event_bus.publish(
                event_type="risk.approval.denied",
                source="risk",
                payload={
                    "symbol": analysis.symbol,
                    "run_id": analysis.run_id,
                    "reasons": approval_reasons,
                    "category": "approval",
                },
            )
            return RiskEvaluationResult(
                approved=False,
                should_halt=False,
                reasons=approval_reasons,
            )

        await self._event_bus.publish(
            event_type="risk.approval.granted",
            source="risk",
            payload={
                "symbol": analysis.symbol,
                "run_id": analysis.run_id,
                "recommendation": analysis.overall_recommendation,
            },
        )
        return RiskEvaluationResult(approved=True)

    async def register_fill(
        self,
        *,
        order: ExecutionOrder,
        previous_position: PaperPosition | None,
    ) -> None:
        if order.side != "sell" or previous_position is None or order.fill_price is None:
            return

        gross = (order.fill_price - previous_position.avg_entry_price) * order.quantity
        realized = round(gross - order.fee_paid, 8)
        self._daily_realized_pnl = round(self._daily_realized_pnl + realized, 8)
        if self._daily_realized_pnl <= -self._policy.daily_loss_limit_usd:
            await self.set_halt(
                f"Daily loss limit {self._policy.daily_loss_limit_usd} breached with realized P&L {self._daily_realized_pnl}."
            )

    async def request_live_mode(self, payload: LiveModeRequest) -> RiskStatusResponse:
        if not payload.enable:
            self._live_mode_enabled = False
            self._live_mode_reason = "Live mode disabled."
            await self._event_bus.publish(
                event_type="risk.live_mode.disabled",
                source="risk",
                payload={"message": self._live_mode_reason},
            )
            return self.status()

        if payload.confirmation_text != LIVE_MODE_CONFIRMATION:
            self._live_mode_enabled = False
            self._live_mode_reason = (
                f"Confirmation text mismatch. Use '{LIVE_MODE_CONFIRMATION}' to enable live mode."
            )
            return self.status()

        if self._settings.app_mode == "mock":
            self._live_mode_enabled = False
            self._live_mode_reason = "APP_MODE=mock cannot enable live trading."
            return self.status()

        if not (self._settings.exchange_api_key and self._settings.exchange_api_secret):
            self._live_mode_enabled = False
            self._live_mode_reason = "Exchange credentials are required before enabling live mode."
            return self.status()

        self._live_mode_enabled = True
        self._live_mode_reason = f"Live mode enabled at {datetime.now(timezone.utc).isoformat()}."
        await self._event_bus.publish(
            event_type="risk.live_mode.enabled",
            source="risk",
            payload={"message": self._live_mode_reason},
        )
        return self.status()
