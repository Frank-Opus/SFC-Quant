from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import uuid4

from app.core.config import Settings
from app.models.execution import ExecutionOrder
from app.models.performance import (
    BacktestRunRequest,
    EquityCurvePoint,
    PerformanceReport,
    PerformanceTrade,
)
from app.services.analysis import _bias_from_change, _recommendation_from_bias
from app.services.market import MarketRuntimeService
from app.services.run_ledger import RunLedgerService


def summarize_performance_report(report: PerformanceReport) -> str:
    if report.trade_count > 0:
        return (
            f"Return {report.total_return:.2f}% · max drawdown {report.max_drawdown:.2f}%"
        )
    return "No realized paper trades yet; tracking equity and drawdown baselines."


@dataclass
class OpenPerformancePosition:
    symbol: str
    timeframe: str
    quantity: float
    avg_entry_price: float
    market_price: float
    opened_at: datetime
    entry_fees_paid: float = 0.0
    run_id: str | None = None


class PaperPerformanceLedger:
    def __init__(self, *, starting_balance: float, seeded_at: datetime | None = None) -> None:
        self.starting_balance = round(starting_balance, 8)
        self.cash_balance = round(starting_balance, 8)
        self._positions: dict[str, OpenPerformancePosition] = {}
        self._equity_curve: list[EquityCurvePoint] = []
        self._trades: list[PerformanceTrade] = []
        self.record_equity(seeded_at or datetime.now(timezone.utc))

    @property
    def trades(self) -> list[PerformanceTrade]:
        return list(self._trades)

    def has_open_position(self, symbol: str) -> bool:
        position = self._positions.get(symbol)
        return position is not None and position.quantity > 0

    def position_quantity(self, symbol: str) -> float:
        position = self._positions.get(symbol)
        if position is None:
            return 0.0
        return round(position.quantity, 8)

    def mark_to_market(
        self,
        *,
        symbol: str,
        price: float,
        timestamp: datetime,
    ) -> None:
        position = self._positions.get(symbol)
        if position is not None:
            position.market_price = price
        self.record_equity(timestamp)

    def apply_fill(self, order: ExecutionOrder) -> None:
        if order.fill_price is None or order.fill_value is None:
            return

        timestamp = order.filled_at or order.created_at
        if order.side == "buy":
            self._apply_buy(order=order, timestamp=timestamp)
        else:
            self._apply_sell(order=order, timestamp=timestamp)
        self.record_equity(timestamp)

    def report(
        self,
        *,
        mode: str,
        symbol: str | None = None,
        timeframe: str | None = None,
        source: str | None = None,
        strategy: str | None = None,
        candle_count: int | None = None,
        latest_run_id: str | None = None,
    ) -> PerformanceReport:
        equity_curve = self._curve_with_drawdown()
        ending_balance = round(equity_curve[-1].equity if equity_curve else self.starting_balance, 8)
        total_return = 0.0
        if self.starting_balance:
            total_return = round(((ending_balance - self.starting_balance) / self.starting_balance) * 100, 4)
        max_drawdown = round(max((point.drawdown for point in equity_curve), default=0.0), 4)
        trade_count = len(self._trades)
        winning_trades = sum(trade.pnl > 0 for trade in self._trades)
        win_rate = round((winning_trades / trade_count) * 100, 4) if trade_count else 0.0
        open_position_count = sum(1 for position in self._positions.values() if position.quantity > 0)
        latest_trade = self._trades[-1] if self._trades else None
        return PerformanceReport(
            mode=mode,
            symbol=symbol,
            timeframe=timeframe,
            source=source,
            strategy=strategy,
            starting_balance=self.starting_balance,
            ending_balance=ending_balance,
            total_return=total_return,
            max_drawdown=max_drawdown,
            win_rate=win_rate,
            trade_count=trade_count,
            candle_count=candle_count,
            equity_curve=equity_curve,
            trades=self.trades,
            open_position_count=open_position_count,
            latest_run_id=latest_run_id,
            latest_trade=latest_trade,
        )

    def _apply_buy(self, *, order: ExecutionOrder, timestamp: datetime) -> None:
        total_cost = round(order.fill_value + order.fee_paid, 8)
        self.cash_balance = round(self.cash_balance - total_cost, 8)
        position = self._positions.get(order.symbol)
        if position is None:
            self._positions[order.symbol] = OpenPerformancePosition(
                symbol=order.symbol,
                timeframe=order.timeframe,
                quantity=order.quantity,
                avg_entry_price=order.fill_price,
                market_price=order.fill_price,
                opened_at=timestamp,
                entry_fees_paid=order.fee_paid,
                run_id=order.run_id,
            )
            return

        total_quantity = position.quantity + order.quantity
        weighted_entry = (
            (position.quantity * position.avg_entry_price) + (order.quantity * order.fill_price)
        ) / total_quantity
        position.quantity = round(total_quantity, 8)
        position.avg_entry_price = round(weighted_entry, 8)
        position.market_price = order.fill_price
        position.entry_fees_paid = round(position.entry_fees_paid + order.fee_paid, 8)
        position.timeframe = order.timeframe
        position.run_id = order.run_id or position.run_id

    def _apply_sell(self, *, order: ExecutionOrder, timestamp: datetime) -> None:
        position = self._positions.get(order.symbol)
        if position is None or position.quantity <= 0:
            return

        sell_quantity = min(order.quantity, position.quantity)
        allocated_entry_fees = 0.0
        if position.quantity > 0:
            allocated_entry_fees = round(position.entry_fees_paid * (sell_quantity / position.quantity), 8)
        proceeds = round(order.fill_value - order.fee_paid, 8)
        self.cash_balance = round(self.cash_balance + proceeds, 8)
        gross_pnl = (order.fill_price - position.avg_entry_price) * sell_quantity
        net_pnl = round(gross_pnl - allocated_entry_fees - order.fee_paid, 8)
        capital_at_risk = (position.avg_entry_price * sell_quantity) + allocated_entry_fees
        pnl_percent = round((net_pnl / capital_at_risk) * 100, 4) if capital_at_risk else 0.0
        if net_pnl > 0:
            outcome = "win"
        elif net_pnl < 0:
            outcome = "loss"
        else:
            outcome = "flat"

        self._trades.append(
            PerformanceTrade(
                trade_id=str(uuid4()),
                symbol=order.symbol,
                timeframe=order.timeframe,
                opened_at=position.opened_at,
                closed_at=timestamp,
                quantity=round(sell_quantity, 8),
                entry_price=position.avg_entry_price,
                exit_price=order.fill_price,
                pnl=net_pnl,
                pnl_percent=pnl_percent,
                fees_paid=round(allocated_entry_fees + order.fee_paid, 8),
                outcome=outcome,
                run_id=order.run_id or position.run_id,
            )
        )

        remaining_quantity = round(position.quantity - sell_quantity, 8)
        remaining_entry_fees = round(position.entry_fees_paid - allocated_entry_fees, 8)
        if remaining_quantity <= 0:
            self._positions.pop(order.symbol, None)
            return

        position.quantity = remaining_quantity
        position.market_price = order.fill_price
        position.entry_fees_paid = remaining_entry_fees

    def record_equity(self, timestamp: datetime) -> None:
        equity = round(
            self.cash_balance
            + sum(position.quantity * position.market_price for position in self._positions.values()),
            8,
        )
        self._equity_curve.append(
            EquityCurvePoint(
                timestamp=timestamp,
                equity=equity,
                cash_balance=round(self.cash_balance, 8),
            )
        )

    def _curve_with_drawdown(self) -> list[EquityCurvePoint]:
        peak_equity = 0.0
        points: list[EquityCurvePoint] = []
        for point in self._equity_curve:
            peak_equity = max(peak_equity, point.equity)
            drawdown_amount = round(max(0.0, peak_equity - point.equity), 8)
            drawdown = round((drawdown_amount / peak_equity) * 100, 4) if peak_equity else 0.0
            points.append(
                point.model_copy(
                    update={
                        "drawdown": drawdown,
                        "drawdown_amount": drawdown_amount,
                    }
                )
            )
        return points


class PerformanceService:
    def __init__(
        self,
        *,
        settings: Settings,
        market_service: MarketRuntimeService,
        execution_service,
        run_ledger: RunLedgerService,
    ) -> None:
        self._settings = settings
        self._market_service = market_service
        self._execution_service = execution_service
        self._run_ledger = run_ledger

    def paper_report(self) -> PerformanceReport:
        report = self._execution_service.performance_report()
        self._append_performance_stage(report)
        return report

    async def run_backtest(self, payload: BacktestRunRequest) -> PerformanceReport:
        symbol = payload.symbol or self._settings.market_symbols[0]
        timeframe = payload.timeframe or self._settings.market_timeframes[0]
        try:
            snapshot = await self._market_service.ensure_snapshot(symbol=symbol, timeframe=timeframe)
        except RuntimeError:
            snapshot = await self._market_service.build_fallback_snapshot(
                symbol=symbol,
                timeframe=timeframe,
            )
        candles = snapshot.candles
        seeded_at = candles[0].timestamp if candles else datetime.now(timezone.utc)
        ledger = PaperPerformanceLedger(
            starting_balance=self._settings.execution_paper_starting_balance,
            seeded_at=seeded_at,
        )

        for index, candle in enumerate(candles):
            ledger.mark_to_market(symbol=symbol, price=candle.close, timestamp=candle.timestamp)
            if index == 0:
                continue

            previous_close = candles[index - 1].close
            change_percent = 0.0
            if previous_close:
                change_percent = round(((candle.close - previous_close) / previous_close) * 100, 2)
            recommendation = _recommendation_from_bias(_bias_from_change(change_percent))

            if recommendation == "buy" and not ledger.has_open_position(symbol):
                quantity = round(
                    min(self._settings.execution_order_notional_usd, ledger.cash_balance) / candle.close,
                    8,
                )
                if quantity <= 0:
                    continue
                order = self._build_backtest_order(
                    symbol=symbol,
                    timeframe=timeframe,
                    side="buy",
                    quantity=quantity,
                    price=candle.close,
                    timestamp=candle.timestamp,
                    run_id=f"backtest-{index}",
                )
                ledger.apply_fill(order)
            elif recommendation == "sell" and ledger.has_open_position(symbol):
                quantity = ledger.position_quantity(symbol)
                if quantity <= 0:
                    continue
                order = self._build_backtest_order(
                    symbol=symbol,
                    timeframe=timeframe,
                    side="sell",
                    quantity=quantity,
                    price=candle.close,
                    timestamp=candle.timestamp,
                    run_id=f"backtest-{index}",
                )
                ledger.apply_fill(order)

        return ledger.report(
            mode="backtest",
            symbol=symbol,
            timeframe=timeframe,
            source=snapshot.source,
            strategy="offline_replay_change_threshold",
            candle_count=len(candles),
        )

    def _build_backtest_order(
        self,
        *,
        symbol: str,
        timeframe: str,
        side: str,
        quantity: float,
        price: float,
        timestamp: datetime,
        run_id: str,
    ) -> ExecutionOrder:
        fill_value = round(quantity * price, 8)
        fee_paid = round(fill_value * self._settings.execution_fee_rate, 8)
        return ExecutionOrder(
            order_id=str(uuid4()),
            run_id=run_id,
            symbol=symbol,
            timeframe=timeframe,
            side=side,
            status="filled",
            quantity=quantity,
            requested_notional=fill_value,
            fill_price=price,
            fill_value=fill_value,
            fee_paid=fee_paid,
            adapter="backtest_replay",
            created_at=timestamp,
            filled_at=timestamp,
            rationale_summary="Offline replay using existing analysis change-threshold heuristics.",
        )

    def _append_performance_stage(self, report: PerformanceReport) -> None:
        run_id = report.latest_run_id
        if run_id is None:
            return
        detail = (
            f"Return {report.total_return:.2f}% · max drawdown {report.max_drawdown:.2f}%"
            if report.trade_count > 0
            else "No realized paper trades yet; tracking equity and drawdown baselines."
        )
        timestamp = (
            report.latest_trade.closed_at
            if report.latest_trade is not None
            else (
                report.equity_curve[-1].timestamp
                if report.equity_curve
                else datetime.now(timezone.utc)
            )
        )
        self._run_ledger.append_stage(
            run_id=run_id,
            symbol=report.symbol or "",
            timeframe=report.timeframe or "",
            stage="performance",
            status="completed" if report.trade_count > 0 else "ready",
            detail=detail,
            actor=report.strategy,
            generated_at=timestamp,
            metadata={
                "mode": report.mode,
                "source": report.source or "paper_execution_runtime",
            },
        )
