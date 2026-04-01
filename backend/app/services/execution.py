from collections import deque
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Protocol
from uuid import uuid4

from app.core.config import Settings
from app.models.analysis import AnalysisRunRequest, AnalysisRunResult
from app.models.execution import (
    ExecutionDispatchRequest,
    ExecutionDispatchResult,
    ExecutionOrder,
    ExecutionStatusResponse,
    PaperPosition,
)
from app.services.analysis import AnalysisService
from app.services.event_bus import EventBus

try:
    import freqtrade  # type: ignore  # noqa: F401
except ImportError:  # pragma: no cover - optional dependency for later phases
    freqtrade = None


class ExecutionAdapter(Protocol):
    name: str

    async def submit_order(
        self,
        *,
        order: ExecutionOrder,
        fill_price: float,
        fee_rate: float,
    ) -> ExecutionOrder:
        ...


class MockFreqtradeExecutionAdapter:
    name = "freqtrade_mock"

    async def submit_order(
        self,
        *,
        order: ExecutionOrder,
        fill_price: float,
        fee_rate: float,
    ) -> ExecutionOrder:
        fill_value = round(fill_price * order.quantity, 8)
        fee_paid = round(fill_value * fee_rate, 8)
        return order.model_copy(
            update={
                "status": "filled",
                "fill_price": fill_price,
                "fill_value": fill_value,
                "fee_paid": fee_paid,
                "filled_at": datetime.now(timezone.utc),
            }
        )


@dataclass
class DispatchDecision:
    side: str | None
    reason: str


class ExecutionService:
    def __init__(
        self,
        *,
        settings: Settings,
        analysis_service: AnalysisService,
        event_bus: EventBus,
    ) -> None:
        self._settings = settings
        self._analysis_service = analysis_service
        self._event_bus = event_bus
        self._adapter = MockFreqtradeExecutionAdapter()
        self._paused = settings.execution_engine_start_paused
        self._paused_reason = (
            "Configured to start paused." if settings.execution_engine_start_paused else None
        )
        self._cash_balance = settings.execution_paper_starting_balance
        self._recent_orders: deque[ExecutionOrder] = deque(
            maxlen=settings.execution_max_recent_orders
        )
        self._positions: dict[str, PaperPosition] = {}
        self._last_run_id: str | None = None

    async def initialize(self) -> None:
        return None

    def status(self) -> ExecutionStatusResponse:
        positions = list(self._positions.values())
        equity_estimate = round(
            self._cash_balance + sum(position.quantity * position.market_price for position in positions),
            8,
        )
        return ExecutionStatusResponse(
            engine_status="paused" if self._paused else "running",
            execution_mode=self._settings.execution_mode,
            adapter=self._adapter.name,
            starting_balance=self._settings.execution_paper_starting_balance,
            cash_balance=round(self._cash_balance, 8),
            equity_estimate=equity_estimate,
            last_run_id=self._last_run_id,
            paused_reason=self._paused_reason,
            recent_orders=list(reversed(self._recent_orders)),
            positions=positions,
        )

    async def pause(self, reason: str | None = None) -> ExecutionStatusResponse:
        self._paused = True
        self._paused_reason = reason or "Paused by operator control."
        await self._event_bus.publish(
            event_type="execution.engine.paused",
            source="execution",
            payload={"reason": self._paused_reason},
        )
        return self.status()

    async def resume(self) -> ExecutionStatusResponse:
        self._paused = False
        self._paused_reason = None
        await self._event_bus.publish(
            event_type="execution.engine.resumed",
            source="execution",
            payload={"message": "Execution engine resumed."},
        )
        return self.status()

    async def dispatch(self, payload: ExecutionDispatchRequest) -> ExecutionDispatchResult:
        analysis = await self._analysis_service.run_analysis(
            AnalysisRunRequest(
                symbol=payload.symbol,
                timeframe=payload.timeframe,
                notes=payload.notes,
            ),
            trigger="manual",
        )
        self._last_run_id = analysis.run_id

        if self._paused:
            await self._event_bus.publish(
                event_type="execution.signal.blocked",
                source="execution",
                payload={
                    "run_id": analysis.run_id,
                    "symbol": payload.symbol,
                    "timeframe": payload.timeframe,
                    "reason": self._paused_reason or "Execution engine paused.",
                },
            )
            return ExecutionDispatchResult(
                engine_status="paused",
                message=self._paused_reason or "Execution engine paused.",
                analysis=analysis,
                order=None,
                status=self.status(),
            )

        decision = self._decide_side(analysis)
        if decision.side is None:
            await self._event_bus.publish(
                event_type="execution.signal.skipped",
                source="execution",
                payload={
                    "run_id": analysis.run_id,
                    "symbol": payload.symbol,
                    "timeframe": payload.timeframe,
                    "reason": decision.reason,
                    "recommendation": analysis.overall_recommendation,
                },
            )
            return ExecutionDispatchResult(
                engine_status="running",
                message=decision.reason,
                analysis=analysis,
                order=None,
                status=self.status(),
            )

        await self._event_bus.publish(
            event_type="execution.signal.approved",
            source="execution",
            payload={
                "run_id": analysis.run_id,
                "symbol": payload.symbol,
                "timeframe": payload.timeframe,
                "side": decision.side,
                "recommendation": analysis.overall_recommendation,
            },
        )

        order = await self._create_and_fill_order(analysis=analysis, side=decision.side)
        return ExecutionDispatchResult(
            engine_status="running",
            message=f"Paper {order.side} order filled via {order.adapter}.",
            analysis=analysis,
            order=order,
            status=self.status(),
        )

    async def _create_and_fill_order(
        self,
        *,
        analysis: AnalysisRunResult,
        side: str,
    ) -> ExecutionOrder:
        price = analysis.market_snapshot.last_price
        quantity = self._resolve_quantity(symbol=analysis.symbol, side=side, price=price)
        if quantity <= 0:
            raise RuntimeError(
                f"Execution quantity resolved to 0 for {analysis.symbol} {side}."
            )
        created_order = ExecutionOrder(
            order_id=str(uuid4()),
            run_id=analysis.run_id,
            symbol=analysis.symbol,
            timeframe=analysis.timeframe,
            side=side,
            status="created",
            quantity=quantity,
            requested_notional=round(quantity * price, 8),
            adapter=self._adapter.name,
            created_at=datetime.now(timezone.utc),
            rationale_summary=analysis.outputs[-1].summary,
        )
        self._recent_orders.append(created_order)
        await self._event_bus.publish(
            event_type="execution.order.created",
            source="execution",
            payload=created_order.model_dump(mode="json"),
        )

        submitted_order = created_order.model_copy(update={"status": "submitted"})
        self._recent_orders[-1] = submitted_order
        await self._event_bus.publish(
            event_type="execution.order.submitted",
            source="execution",
            payload=submitted_order.model_dump(mode="json"),
        )

        filled_order = await self._adapter.submit_order(
            order=submitted_order,
            fill_price=price,
            fee_rate=self._settings.execution_fee_rate,
        )
        self._recent_orders[-1] = filled_order
        await self._apply_fill(filled_order)
        await self._event_bus.publish(
            event_type="execution.order.filled",
            source="execution",
            payload=filled_order.model_dump(mode="json"),
        )
        return filled_order

    def _resolve_quantity(self, *, symbol: str, side: str, price: float) -> float:
        if side == "buy":
            requested_notional = min(self._settings.execution_order_notional_usd, self._cash_balance)
            quantity = requested_notional / price if price else 0.0
            return round(quantity, 8)

        position = self._positions.get(symbol)
        if position is None:
            return 0.0
        return round(position.quantity, 8)

    async def _apply_fill(self, order: ExecutionOrder) -> None:
        if order.fill_price is None or order.fill_value is None:
            return

        position = self._positions.get(order.symbol)
        now = datetime.now(timezone.utc)
        if order.side == "buy":
            total_cost = order.fill_value + order.fee_paid
            self._cash_balance = round(self._cash_balance - total_cost, 8)
            if position is None:
                updated_position = PaperPosition(
                    symbol=order.symbol,
                    quantity=order.quantity,
                    avg_entry_price=order.fill_price,
                    market_price=order.fill_price,
                    unrealized_pnl=0.0,
                    updated_at=now,
                )
            else:
                total_quantity = position.quantity + order.quantity
                weighted_entry = (
                    (position.quantity * position.avg_entry_price)
                    + (order.quantity * order.fill_price)
                ) / total_quantity
                updated_position = position.model_copy(
                    update={
                        "quantity": round(total_quantity, 8),
                        "avg_entry_price": round(weighted_entry, 8),
                        "market_price": order.fill_price,
                        "unrealized_pnl": round((order.fill_price - weighted_entry) * total_quantity, 8),
                        "updated_at": now,
                    }
                )
            self._positions[order.symbol] = updated_position
        else:
            if position is None:
                return
            proceeds = order.fill_value - order.fee_paid
            self._cash_balance = round(self._cash_balance + proceeds, 8)
            remaining_quantity = round(position.quantity - order.quantity, 8)
            if remaining_quantity <= 0:
                self._positions.pop(order.symbol, None)
                updated_position = None
            else:
                updated_position = position.model_copy(
                    update={
                        "quantity": remaining_quantity,
                        "market_price": order.fill_price,
                        "unrealized_pnl": round(
                            (order.fill_price - position.avg_entry_price) * remaining_quantity,
                            8,
                        ),
                        "updated_at": now,
                    }
                )
                self._positions[order.symbol] = updated_position

        position_payload = (
            updated_position.model_dump(mode="json") if updated_position is not None else {"symbol": order.symbol, "closed": True}
        )
        position_payload["cash_balance"] = round(self._cash_balance, 8)
        await self._event_bus.publish(
            event_type="execution.position.updated",
            source="execution",
            payload=position_payload,
        )

    def _decide_side(self, analysis: AnalysisRunResult) -> DispatchDecision:
        recommendation = analysis.overall_recommendation
        position = self._positions.get(analysis.symbol)
        if recommendation == "buy":
            if self._cash_balance <= 0:
                return DispatchDecision(None, "Paper cash balance is exhausted.")
            return DispatchDecision("buy", "Risk decision approved a paper buy order.")
        if recommendation == "sell":
            if position is None or position.quantity <= 0:
                return DispatchDecision(None, "Sell recommendation skipped because no paper position is open.")
            return DispatchDecision("sell", "Risk decision approved a paper sell order.")
        return DispatchDecision(None, f"Recommendation '{recommendation}' does not place a paper order.")
