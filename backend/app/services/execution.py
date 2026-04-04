from collections import deque
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Protocol
from uuid import uuid4

import httpx

from app.core.config import Settings
from app.models.analysis import AnalysisRunRequest, AnalysisRunResult
from app.models.execution import (
    ExecutionAdapterRuntime,
    ExecutionDispatchRequest,
    ExecutionDispatchResult,
    ExecutionOrder,
    ExecutionStatusResponse,
    PaperPosition,
)
from app.models.performance import PerformanceReport
from app.services.analysis import AnalysisService
from app.services.event_bus import EventBus
from app.services.performance import PaperPerformanceLedger, summarize_performance_report
from app.services.run_ledger import RunLedgerService

try:
    import freqtrade  # type: ignore  # noqa: F401
except ImportError:  # pragma: no cover - optional dependency for later phases
    freqtrade = None


class ExecutionAdapter(Protocol):
    name: str

    async def initialize(self) -> None:
        ...

    def runtime(self) -> ExecutionAdapterRuntime:
        ...

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

    async def initialize(self) -> None:
        return None

    def runtime(self) -> ExecutionAdapterRuntime:
        return ExecutionAdapterRuntime(
            configured=True,
            status="mock",
            detail="Mock Freqtrade adapter active; fills are simulated in-process.",
        )

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
                "adapter_detail": "Mock adapter filled the paper order locally.",
            }
        )


class FreqtradeRestPaperExecutionAdapter:
    name = "freqtrade_rest_paper"

    def __init__(self, settings: Settings) -> None:
        self._base_url = (settings.execution_freqtrade_rest_base_url or "").rstrip("/")
        self._username = settings.execution_freqtrade_rest_username
        self._password = settings.execution_freqtrade_rest_password
        self._timeout_seconds = settings.execution_freqtrade_rest_timeout_seconds
        self._order_type = settings.execution_freqtrade_rest_order_type
        self._runtime = ExecutionAdapterRuntime(
            configured=False,
            status="offline",
            detail="Freqtrade REST paper adapter selected but not initialized yet.",
            endpoint=self._base_url or None,
        )

    async def initialize(self) -> None:
        await self.refresh_runtime()

    def runtime(self) -> ExecutionAdapterRuntime:
        return self._runtime

    async def refresh_runtime(self) -> ExecutionAdapterRuntime:
        now = datetime.now(timezone.utc)
        if not self._base_url:
            self._runtime = ExecutionAdapterRuntime(
                configured=False,
                status="offline",
                detail=(
                    "Freqtrade REST paper adapter is selected, but "
                    "EXECUTION_FREQTRADE_REST_BASE_URL is not configured."
                ),
                last_checked_at=now,
            )
            return self._runtime

        if not self._username or not self._password:
            self._runtime = ExecutionAdapterRuntime(
                configured=False,
                status="offline",
                detail=(
                    "Freqtrade REST paper adapter is selected, but REST credentials "
                    "are missing."
                ),
                last_checked_at=now,
                endpoint=self._base_url,
            )
            return self._runtime

        try:
            await self._request_json("GET", "/api/v1/ping", auth=False)
            config_payload = await self._request_json("GET", "/api/v1/show_config")
        except Exception as exc:  # pragma: no cover - exercised by tests
            self._runtime = ExecutionAdapterRuntime(
                configured=True,
                status="offline",
                detail="Freqtrade REST paper adapter is offline or unreachable.",
                last_checked_at=now,
                last_error=str(exc),
                endpoint=self._base_url,
            )
            return self._runtime

        if not bool(config_payload.get("dry_run")):
            self._runtime = ExecutionAdapterRuntime(
                configured=True,
                status="degraded",
                detail=(
                    "Freqtrade REST is reachable, but dry-run mode is disabled. "
                    "Paper execution stays blocked."
                ),
                last_checked_at=now,
                endpoint=self._base_url,
            )
            return self._runtime

        self._runtime = ExecutionAdapterRuntime(
            configured=True,
            status="connected",
            detail="Freqtrade REST dry-run adapter connected and ready for paper orders.",
            last_checked_at=now,
            endpoint=self._base_url,
        )
        return self._runtime

    async def submit_order(
        self,
        *,
        order: ExecutionOrder,
        fill_price: float,
        fee_rate: float,
    ) -> ExecutionOrder:
        runtime = await self.refresh_runtime()
        if runtime.status != "connected":
            return order.model_copy(
                update={
                    "status": "blocked",
                    "adapter_detail": runtime.detail,
                }
            )

        trade_id: str | None = order.adapter_trade_id
        try:
            payload = await self._submit_freqtrade_order(order)
            trade_id_value = payload.get("trade_id") or payload.get("id") or trade_id
            if trade_id_value is None:
                raise RuntimeError("Freqtrade REST did not return a trade id.")
            trade_id = str(trade_id_value)
            trade_payload = await self._request_json("GET", f"/api/v1/trade/{trade_id}")
        except Exception as exc:
            now = datetime.now(timezone.utc)
            self._runtime = ExecutionAdapterRuntime(
                configured=True,
                status="degraded",
                detail="Freqtrade REST paper order failed after connectivity check.",
                last_checked_at=now,
                last_error=str(exc),
                endpoint=self._base_url,
            )
            return order.model_copy(
                update={
                    "status": "blocked",
                    "adapter_trade_id": trade_id,
                    "adapter_detail": f"Freqtrade REST paper order failed and was blocked: {exc}",
                }
            )

        return self._hydrate_order_from_trade(
            order=order,
            trade_id=trade_id,
            trade_payload=trade_payload,
            fallback_fill_price=fill_price,
            fee_rate=fee_rate,
        )

    def _hydrate_order_from_trade(
        self,
        *,
        order: ExecutionOrder,
        trade_id: str,
        trade_payload: dict,
        fallback_fill_price: float,
        fee_rate: float,
    ) -> ExecutionOrder:
        quantity = round(float(trade_payload.get("amount") or order.quantity), 8)

        if order.side == "buy":
            fill_price = float(trade_payload.get("open_rate") or fallback_fill_price)
            if not trade_payload.get("is_open", False) and "open_rate" not in trade_payload:
                return order.model_copy(
                    update={
                        "status": "submitted",
                        "adapter_trade_id": trade_id,
                        "adapter_detail": (
                            "Freqtrade REST accepted the entry, but the dry-run trade "
                            "is not confirmed as open yet."
                        ),
                    }
                )
            fill_value = round(
                float(trade_payload.get("stake_amount") or (fill_price * quantity)),
                8,
            )
            fee_paid = self._resolve_fee(
                trade_payload=trade_payload,
                fallback_fill_value=fill_value,
                fee_rate=fee_rate,
                side="buy",
            )
            detail = "Freqtrade REST dry-run entry confirmed."
        else:
            fill_price = float(trade_payload.get("close_rate") or fallback_fill_price)
            if trade_payload.get("is_open", True) and "close_rate" not in trade_payload:
                return order.model_copy(
                    update={
                        "status": "submitted",
                        "adapter_trade_id": trade_id,
                        "adapter_detail": (
                            "Freqtrade REST accepted the exit, but the dry-run trade "
                            "is still open."
                        ),
                    }
                )
            fill_value = round(fill_price * quantity, 8)
            fee_paid = self._resolve_fee(
                trade_payload=trade_payload,
                fallback_fill_value=fill_value,
                fee_rate=fee_rate,
                side="sell",
            )
            detail = "Freqtrade REST dry-run exit confirmed."

        return order.model_copy(
            update={
                "status": "filled",
                "quantity": quantity,
                "fill_price": fill_price,
                "fill_value": fill_value,
                "fee_paid": fee_paid,
                "filled_at": datetime.now(timezone.utc),
                "adapter_trade_id": trade_id,
                "adapter_detail": detail,
            }
        )

    def _resolve_fee(
        self,
        *,
        trade_payload: dict,
        fallback_fill_value: float,
        fee_rate: float,
        side: str,
    ) -> float:
        fee_field = "fee_open_cost" if side == "buy" else "fee_close_cost"
        if trade_payload.get(fee_field) is not None:
            return round(float(trade_payload[fee_field]), 8)
        return round(fallback_fill_value * fee_rate, 8)

    async def _submit_freqtrade_order(self, order: ExecutionOrder) -> dict:
        if order.side == "buy":
            return await self._request_json(
                "POST",
                "/api/v1/forceenter",
                {
                    "pair": order.symbol,
                    "side": "long",
                    "ordertype": self._order_type,
                    "stakeamount": order.requested_notional,
                },
            )

        if not order.adapter_trade_id:
            raise RuntimeError(
                f"Freqtrade exit for {order.symbol} is missing the tracked trade id."
            )

        trade_id: int | str = order.adapter_trade_id
        if str(trade_id).isdigit():
            trade_id = int(str(trade_id))
        return await self._request_json(
            "POST",
            "/api/v1/forceexit",
            {
                "tradeid": trade_id,
                "ordertype": self._order_type,
            },
        )

    async def _request_json(
        self,
        method: str,
        path: str,
        payload: dict | None = None,
        *,
        auth: bool = True,
    ) -> dict:
        auth_config = None
        if auth:
            auth_config = httpx.BasicAuth(self._username or "", self._password or "")

        async with httpx.AsyncClient(
            base_url=self._base_url,
            timeout=self._timeout_seconds,
            trust_env=False,
        ) as client:
            response = await client.request(
                method=method,
                url=path,
                json=payload,
                auth=auth_config,
            )
            response.raise_for_status()
            data = response.json()
            if not isinstance(data, dict):
                raise RuntimeError(f"Unexpected Freqtrade response payload for {path}.")
            return data


def build_execution_adapter(settings: Settings) -> ExecutionAdapter:
    if settings.execution_adapter == "freqtrade_rest_paper":
        return FreqtradeRestPaperExecutionAdapter(settings)
    if settings.execution_adapter == "freqtrade_mock":
        return MockFreqtradeExecutionAdapter()
    raise RuntimeError(f"Unsupported execution adapter: {settings.execution_adapter}")


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
        run_ledger: RunLedgerService,
    ) -> None:
        self._settings = settings
        self._analysis_service = analysis_service
        self._event_bus = event_bus
        self._run_ledger = run_ledger
        self._adapter = build_execution_adapter(settings)
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
        self._risk_service = None
        self._performance_ledger = PaperPerformanceLedger(
            starting_balance=settings.execution_paper_starting_balance
        )

    async def initialize(self) -> None:
        await self._adapter.initialize()

    def set_risk_service(self, risk_service) -> None:
        self._risk_service = risk_service

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
            adapter_runtime=self._adapter.runtime(),
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
        self._mark_to_market(
            symbol=analysis.symbol,
            price=analysis.market_snapshot.last_price,
            timestamp=analysis.market_snapshot.generated_at,
        )

        if self._paused:
            self._run_ledger.append_stage(
                run_id=analysis.run_id,
                symbol=payload.symbol,
                timeframe=payload.timeframe,
                stage="execution",
                status="blocked",
                detail=self._paused_reason or "Execution engine paused.",
                actor=self._adapter.name,
            )
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
            self._run_ledger.append_stage(
                run_id=analysis.run_id,
                symbol=payload.symbol,
                timeframe=payload.timeframe,
                stage="execution",
                status="ready",
                detail=decision.reason,
                actor=self._adapter.name,
            )
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

        preview_notional = round(
            self._resolve_quantity(
                symbol=analysis.symbol,
                side=decision.side,
                price=analysis.market_snapshot.last_price,
            )
            * analysis.market_snapshot.last_price,
            8,
        )
        if self._risk_service is not None:
            evaluation = await self._risk_service.evaluate_pretrade(
                analysis=analysis,
                execution_status=self.status(),
                requested_notional=preview_notional,
                current_position=self._positions.get(analysis.symbol),
            )
            if not evaluation.approved:
                self._run_ledger.append_stage(
                    run_id=analysis.run_id,
                    symbol=payload.symbol,
                    timeframe=payload.timeframe,
                    stage="execution",
                    status="blocked",
                    detail="; ".join(evaluation.reasons),
                    actor="risk_guard",
                )
                return ExecutionDispatchResult(
                    engine_status="paused" if evaluation.should_halt else "running",
                    message="; ".join(evaluation.reasons),
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
        self._run_ledger.append_stage(
            run_id=analysis.run_id,
            symbol=payload.symbol,
            timeframe=payload.timeframe,
            stage="execution",
            status="running",
            detail=f"Dispatch approved; submitting {decision.side} order via {self._adapter.name}.",
            actor=self._adapter.name,
        )

        order = await self._create_and_fill_order(analysis=analysis, side=decision.side)
        message = order.adapter_detail or f"Paper {order.side} order processed via {order.adapter}."
        return ExecutionDispatchResult(
            engine_status="running",
            message=message,
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

        current_position = self._positions.get(analysis.symbol)
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
            adapter_trade_id=current_position.adapter_trade_id if current_position else None,
            created_at=datetime.now(timezone.utc),
            rationale_summary=analysis.outputs[-1].summary,
        )
        self._recent_orders.append(created_order)
        self._run_ledger.append_stage(
            run_id=analysis.run_id,
            symbol=analysis.symbol,
            timeframe=analysis.timeframe,
            stage="execution",
            status="running",
            detail=f"Created {side} order for {analysis.symbol} {analysis.timeframe}.",
            actor=self._adapter.name,
            generated_at=created_order.created_at,
        )
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

        resolved_order = await self._adapter.submit_order(
            order=submitted_order,
            fill_price=price,
            fee_rate=self._settings.execution_fee_rate,
        )
        self._recent_orders[-1] = resolved_order

        if resolved_order.status == "blocked":
            self._run_ledger.append_stage(
                run_id=analysis.run_id,
                symbol=analysis.symbol,
                timeframe=analysis.timeframe,
                stage="execution",
                status="blocked",
                detail=(
                    resolved_order.adapter_detail
                    or "Execution adapter blocked the paper order."
                ),
                actor=self._adapter.name,
                generated_at=resolved_order.filled_at or datetime.now(timezone.utc),
            )
            await self._event_bus.publish(
                event_type="execution.signal.blocked",
                source="execution",
                payload={
                    "run_id": analysis.run_id,
                    "symbol": analysis.symbol,
                    "timeframe": analysis.timeframe,
                    "reason": resolved_order.adapter_detail
                    or "Execution adapter blocked the paper order.",
                    "adapter": self._adapter.name,
                },
            )
            return resolved_order

        if resolved_order.status != "filled":
            self._run_ledger.append_stage(
                run_id=analysis.run_id,
                symbol=analysis.symbol,
                timeframe=analysis.timeframe,
                stage="execution",
                status="running",
                detail=resolved_order.adapter_detail or "Paper order submitted and awaiting completion.",
                actor=self._adapter.name,
                generated_at=resolved_order.created_at,
            )
            return resolved_order

        previous_position = self._positions.get(resolved_order.symbol)
        await self._apply_fill(resolved_order)
        if self._risk_service is not None:
            await self._risk_service.register_fill(
                order=resolved_order,
                previous_position=previous_position,
            )
        await self._event_bus.publish(
            event_type="execution.order.filled",
            source="execution",
            payload=resolved_order.model_dump(mode="json"),
        )
        self._run_ledger.append_stage(
            run_id=analysis.run_id,
            symbol=analysis.symbol,
            timeframe=analysis.timeframe,
            stage="execution",
            status="completed",
            detail=resolved_order.adapter_detail or f"{resolved_order.side} order filled.",
            actor=self._adapter.name,
            generated_at=resolved_order.filled_at or datetime.now(timezone.utc),
        )
        return resolved_order

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
                    adapter_trade_id=order.adapter_trade_id,
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
                        "adapter_trade_id": order.adapter_trade_id or position.adapter_trade_id,
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
            updated_position.model_dump(mode="json")
            if updated_position is not None
            else {"symbol": order.symbol, "closed": True}
        )
        position_payload["cash_balance"] = round(self._cash_balance, 8)
        await self._event_bus.publish(
            event_type="execution.position.updated",
            source="execution",
            payload=position_payload,
        )
        self._performance_ledger.apply_fill(order)
        performance_report = self.performance_report()
        self._run_ledger.append_stage(
            run_id=order.run_id,
            symbol=order.symbol,
            timeframe=order.timeframe,
            stage="performance",
            status="completed" if performance_report.trade_count > 0 else "running",
            detail=summarize_performance_report(performance_report),
            actor=performance_report.strategy,
            generated_at=order.filled_at or now,
        )

    def performance_report(self) -> PerformanceReport:
        primary_position = next(iter(self._positions.values()), None)
        return self._performance_ledger.report(
            mode="paper",
            symbol=primary_position.symbol if primary_position is not None else None,
            timeframe=None,
            source=self._adapter.name,
            strategy="paper_execution_runtime",
            latest_run_id=self._last_run_id,
        )

    def _mark_to_market(
        self,
        *,
        symbol: str,
        price: float,
        timestamp: datetime,
    ) -> None:
        position = self._positions.get(symbol)
        if position is not None:
            self._positions[symbol] = position.model_copy(
                update={
                    "market_price": price,
                    "unrealized_pnl": round((price - position.avg_entry_price) * position.quantity, 8),
                    "updated_at": timestamp,
                }
            )
        self._performance_ledger.mark_to_market(
            symbol=symbol,
            price=price,
            timestamp=timestamp,
        )

    def _decide_side(self, analysis: AnalysisRunResult) -> DispatchDecision:
        recommendation = analysis.overall_recommendation
        position = self._positions.get(analysis.symbol)
        if recommendation == "buy":
            if self._cash_balance <= 0:
                return DispatchDecision(None, "Paper cash balance is exhausted.")
            if (
                self._adapter.name == "freqtrade_rest_paper"
                and position is not None
                and position.quantity > 0
            ):
                return DispatchDecision(
                    None,
                    (
                        "Freqtrade REST paper mode currently supports one open trade per "
                        "symbol; additional buys are blocked until multi-trade "
                        "reconciliation is implemented."
                    ),
                )
            return DispatchDecision("buy", "Risk decision approved a paper buy order.")
        if recommendation == "sell":
            if position is None or position.quantity <= 0:
                return DispatchDecision(None, "Sell recommendation skipped because no paper position is open.")
            return DispatchDecision("sell", "Risk decision approved a paper sell order.")
        return DispatchDecision(None, f"Recommendation '{recommendation}' does not place a paper order.")
