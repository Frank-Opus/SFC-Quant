from __future__ import annotations

from datetime import datetime, timezone

from app.models.analysis import AnalysisRunResult
from app.models.events import EventEnvelope
from app.models.performance import PerformanceReport
from app.models.run_ledger import RunLedgerRecord
from app.models.workflow import (
    WorkflowFact,
    WorkflowNotice,
    WorkflowProviderState,
    WorkflowRoleState,
    WorkflowSnapshotResponse,
    WorkflowStageKey,
    WorkflowStageState,
    WorkflowStageStatus,
)
from app.services.analysis import AnalysisService
from app.services.execution import ExecutionService
from app.services.market import MarketRuntimeService
from app.services.performance import PerformanceService, summarize_performance_report
from app.services.risk import RiskService
from app.services.run_ledger import RunLedgerService
from app.services.strategy_factory import StrategyFactoryService


class WorkflowService:
    def __init__(
        self,
        *,
        market_service: MarketRuntimeService,
        analysis_service: AnalysisService,
        strategy_factory_service: StrategyFactoryService,
        execution_service: ExecutionService,
        risk_service: RiskService,
        performance_service: PerformanceService,
        run_ledger: RunLedgerService,
    ) -> None:
        self._market_service = market_service
        self._analysis_service = analysis_service
        self._strategy_factory_service = strategy_factory_service
        self._execution_service = execution_service
        self._risk_service = risk_service
        self._performance_service = performance_service
        self._run_ledger = run_ledger

    async def snapshot(
        self,
        *,
        symbol: str | None = None,
        timeframe: str | None = None,
    ) -> WorkflowSnapshotResponse:
        market_snapshot_response = self._market_service.snapshot_response(limit=24)
        focus_symbol, focus_timeframe = self._resolve_focus(
            market_snapshot_response=market_snapshot_response,
            symbol=symbol,
            timeframe=timeframe,
        )
        focus_snapshot = next(
            (
                snapshot
                for snapshot in market_snapshot_response.snapshots
                if snapshot.symbol == focus_symbol and snapshot.timeframe == focus_timeframe
            ),
            None,
        )
        latest_analysis = self._analysis_service.latest_analysis(
            symbol=focus_symbol,
            timeframe=focus_timeframe,
        )
        strategy_status = self._strategy_factory_service.status()
        execution_status = self._execution_service.status()
        risk_status = self._risk_service.status()
        paper_report = self._performance_service.paper_report()
        role_states = self._build_role_states(latest_analysis=latest_analysis)
        provider_states = self._build_provider_states(strategy_status=strategy_status)
        notices = self._build_notices(
            market_snapshot_response=market_snapshot_response,
            strategy_status=strategy_status,
            execution_status=execution_status,
            risk_status=risk_status,
        )

        current_run_id = self._resolve_current_run_id(
            symbol=focus_symbol,
            timeframe=focus_timeframe,
            latest_analysis=latest_analysis,
            strategy_status=strategy_status,
            execution_status=execution_status,
            paper_report=paper_report,
        )
        stages = {
            "market": self._market_stage(
                market_snapshot_response=market_snapshot_response,
                focus_snapshot=focus_snapshot,
            ),
            "analysis": self._analysis_stage(latest_analysis=latest_analysis),
            "strategy": self._strategy_stage(strategy_status=strategy_status),
            "risk": self._risk_stage(
                risk_status=risk_status,
                recent_events=market_snapshot_response.recent_events,
                current_run_id=current_run_id,
            ),
            "execution": self._execution_stage(execution_status=execution_status),
            "performance": self._performance_stage(
                paper_report=paper_report,
                current_run_id=current_run_id,
            ),
        }
        stages = self._merge_stages_with_run_ledger(
            stages=stages,
            current_run_id=current_run_id,
        )
        active_stage_key = self._resolve_active_stage_key(
            stages=stages,
            current_run_id=current_run_id,
        )
        generated_at = max(
            [
                stage.updated_at
                for stage in stages.values()
                if stage.updated_at is not None
            ]
            or [datetime.now(timezone.utc)]
        )

        return WorkflowSnapshotResponse(
            generated_at=generated_at,
            symbol=focus_symbol,
            timeframe=focus_timeframe,
            current_run_id=current_run_id,
            active_stage_key=active_stage_key,
            current_handoff=self._resolve_current_handoff(
                active_stage_key=active_stage_key,
                stages=stages,
                current_run_id=current_run_id,
            ),
            execution_mode=execution_status.execution_mode,
            execution_adapter=execution_status.adapter,
            requested_market_source=market_snapshot_response.market_data.requested_source,
            effective_market_source=market_snapshot_response.market_data.effective_source,
            stages=stages,
            roles=role_states,
            providers=provider_states,
            notices=notices,
        )

    def _resolve_focus(
        self,
        *,
        market_snapshot_response,
        symbol: str | None,
        timeframe: str | None,
    ) -> tuple[str, str]:
        if symbol and timeframe:
            return symbol, timeframe
        if market_snapshot_response.snapshots:
            first = market_snapshot_response.snapshots[0]
            return symbol or first.symbol, timeframe or first.timeframe
        default_symbol = self._market_service._settings.market_symbols[0]
        default_timeframe = self._market_service._settings.market_timeframes[0]
        return symbol or default_symbol, timeframe or default_timeframe

    def _market_stage(self, *, market_snapshot_response, focus_snapshot) -> WorkflowStageState:
        market_data = market_snapshot_response.market_data
        status_map = {
            "live": "completed",
            "mock": "ready",
            "pending": "running",
            "fallback": "degraded",
            "degraded": "degraded",
        }
        status = status_map.get(market_data.status, "degraded")
        facts = [
            WorkflowFact(label="Requested", value=market_data.requested_source.upper(), tone="info"),
            WorkflowFact(
                label="Effective",
                value=market_data.effective_source.upper(),
                tone="positive" if market_data.effective_source == "ccxt" else "warning",
            ),
            WorkflowFact(label="Status", value=market_data.status.upper(), tone="neutral"),
        ]
        if focus_snapshot is not None:
            facts.append(
                WorkflowFact(
                    label="Instrument",
                    value=f"{focus_snapshot.symbol} {focus_snapshot.timeframe}",
                    tone="neutral",
                )
            )
        return WorkflowStageState(
            key="market",
            label="Market Feed",
            status=status,
            detail=market_data.detail,
            updated_at=focus_snapshot.generated_at if focus_snapshot is not None else market_snapshot_response.generated_at,
            actor=market_data.effective_source,
            facts=facts,
        )

    def _analysis_stage(self, *, latest_analysis: AnalysisRunResult | None) -> WorkflowStageState:
        if latest_analysis is None:
            return WorkflowStageState(
                key="analysis",
                label="PrimoAgent",
                status="idle",
                detail="No correlated analysis run is available yet.",
            )
        facts = [
            WorkflowFact(label="Recommendation", value=latest_analysis.overall_recommendation.upper(), tone="info"),
            WorkflowFact(label="Roles", value=str(len(latest_analysis.outputs)), tone="neutral"),
            WorkflowFact(label="Provider", value=latest_analysis.provider, tone="neutral"),
        ]
        summary = latest_analysis.outputs[-1].summary if latest_analysis.outputs else None
        return WorkflowStageState(
            key="analysis",
            label="PrimoAgent",
            status="completed" if latest_analysis.status == "completed" else "degraded",
            detail=summary,
            updated_at=latest_analysis.completed_at,
            run_id=latest_analysis.run_id,
            actor=latest_analysis.model,
            facts=facts,
        )

    def _strategy_stage(self, *, strategy_status) -> WorkflowStageState:
        generation = strategy_status.generation
        if not strategy_status.enabled:
            return WorkflowStageState(
                key="strategy",
                label="Strategy Factory",
                status="idle",
                detail=strategy_status.reason,
                facts=[
                    WorkflowFact(label="Configured", value=strategy_status.configured_provider, tone="neutral"),
                    WorkflowFact(label="Effective", value=strategy_status.effective_provider, tone="neutral"),
                ],
            )
        status = self._map_generation_status(generation.status)
        return WorkflowStageState(
            key="strategy",
            label="Strategy Factory",
            status=status,
            detail=generation.detail or strategy_status.reason,
            updated_at=generation.updated_at or generation.completed_at,
            run_id=generation.run_id or (strategy_status.latest_artifact.run_id if strategy_status.latest_artifact else None),
            actor=generation.provider_label or strategy_status.effective_provider,
            facts=[
                WorkflowFact(label="Configured", value=strategy_status.configured_provider, tone="neutral"),
                WorkflowFact(label="Effective", value=strategy_status.effective_provider, tone="info"),
                WorkflowFact(label="Artifacts", value=str(strategy_status.artifact_count), tone="neutral"),
            ],
        )

    def _risk_stage(
        self,
        *,
        risk_status,
        recent_events: list[EventEnvelope],
        current_run_id: str | None,
    ) -> WorkflowStageState:
        updated_at = self._latest_event_time(recent_events=recent_events, prefix="risk.")
        if risk_status.halted:
            status: WorkflowStageStatus = "blocked"
            detail = risk_status.halt_reason or "Risk halt is active."
        else:
            status = "ready"
            detail = (
                f"Daily realized P&L {risk_status.daily_realized_pnl:.2f}; "
                f"live mode {'enabled' if risk_status.live_mode_enabled else 'disabled'}."
            )
        return WorkflowStageState(
            key="risk",
            label="Risk Guard",
            status=status,
            detail=detail,
            updated_at=updated_at,
            run_id=current_run_id,
            actor="policy engine",
            facts=[
                WorkflowFact(label="Loss Limit", value=f"{risk_status.policy.daily_loss_limit_usd:.0f} USD", tone="neutral"),
                WorkflowFact(label="Live Gate", value="ON" if risk_status.live_mode_enabled else "OFF", tone="warning" if risk_status.live_mode_enabled else "positive"),
                WorkflowFact(label="Approval", value="Required" if risk_status.policy.require_agent_approval else "Optional", tone="neutral"),
            ],
        )

    def _execution_stage(self, *, execution_status) -> WorkflowStageState:
        latest_order = execution_status.recent_orders[0] if execution_status.recent_orders else None
        runtime = execution_status.adapter_runtime
        updated_at = None
        detail = runtime.detail
        status: WorkflowStageStatus = "ready"
        if runtime.status in {"offline", "degraded"}:
            status = "degraded"
            detail = runtime.last_error or runtime.detail
        elif execution_status.engine_status == "paused":
            status = "blocked"
            detail = execution_status.paused_reason or runtime.detail
        elif latest_order is not None:
            updated_at = latest_order.filled_at or latest_order.created_at
            detail = latest_order.adapter_detail or latest_order.rationale_summary
            if latest_order.status == "filled":
                status = "completed"
            elif latest_order.status == "blocked":
                status = "blocked"
            else:
                status = "running"
        else:
            updated_at = runtime.last_checked_at
        return WorkflowStageState(
            key="execution",
            label="Paper Execution",
            status=status,
            detail=detail,
            updated_at=updated_at,
            run_id=execution_status.last_run_id,
            actor=execution_status.adapter,
            facts=[
                WorkflowFact(label="Adapter", value=execution_status.adapter, tone="info"),
                WorkflowFact(label="Cash", value=f"{execution_status.cash_balance:.2f} USD", tone="neutral"),
                WorkflowFact(label="Positions", value=str(len(execution_status.positions)), tone="neutral"),
            ],
        )

    def _performance_stage(
        self,
        *,
        paper_report: PerformanceReport,
        current_run_id: str | None,
    ) -> WorkflowStageState:
        latest_trade = paper_report.latest_trade
        updated_at = (
            latest_trade.closed_at
            if latest_trade is not None
            else (paper_report.equity_curve[-1].timestamp if paper_report.equity_curve else None)
        )
        status: WorkflowStageStatus = "completed" if paper_report.trade_count > 0 else "ready"
        detail = (
            summarize_performance_report(paper_report)
        )
        return WorkflowStageState(
            key="performance",
            label="Performance",
            status=status,
            detail=detail,
            updated_at=updated_at,
            run_id=paper_report.latest_run_id or current_run_id,
            actor=paper_report.strategy,
            facts=[
                WorkflowFact(label="Trades", value=str(paper_report.trade_count), tone="neutral"),
                WorkflowFact(label="Return", value=f"{paper_report.total_return:.2f}%", tone="positive" if paper_report.total_return >= 0 else "danger"),
                WorkflowFact(label="Drawdown", value=f"{paper_report.max_drawdown:.2f}%", tone="warning"),
                WorkflowFact(
                    label="Open Positions",
                    value=str(paper_report.open_position_count),
                    tone="warning" if paper_report.open_position_count else "neutral",
                ),
            ],
        )

    def _merge_stages_with_run_ledger(
        self,
        *,
        stages: dict[WorkflowStageKey, WorkflowStageState],
        current_run_id: str | None,
    ) -> dict[WorkflowStageKey, WorkflowStageState]:
        if current_run_id is None:
            return stages
        merged: dict[WorkflowStageKey, WorkflowStageState] = {}
        for key, stage in stages.items():
            if key == "market" or key == "risk":
                merged[key] = stage
                continue
            ledger_record = self._run_ledger.latest_stage_record(current_run_id, key)
            if ledger_record is None:
                merged[key] = stage
                continue
            update: dict[str, object] = {
                "run_id": ledger_record.run_id,
            }
            if (
                stage.updated_at is None
                or ledger_record.generated_at >= stage.updated_at
            ):
                update["updated_at"] = ledger_record.generated_at
            if ledger_record.actor and not stage.actor:
                update["actor"] = ledger_record.actor
            if ledger_record.detail and (
                stage.detail is None
                or stage.status in {"idle", "ready"}
                or ledger_record.generated_at >= (stage.updated_at or ledger_record.generated_at)
            ):
                update["detail"] = ledger_record.detail
            if stage.status in {"idle", "ready"} and ledger_record.status not in {"idle", "ready"}:
                update["status"] = ledger_record.status
            merged[key] = stage.model_copy(update=update)
        return merged

    def _build_role_states(self, *, latest_analysis: AnalysisRunResult | None) -> list[WorkflowRoleState]:
        if latest_analysis is None:
            return []
        return [
            WorkflowRoleState(
                role=output.role,
                label=self._role_label(output.role),
                status="completed" if output.status == "completed" else "degraded",
                provider=output.provider,
                model=output.model,
                recommendation=output.recommendation,
                confidence=output.confidence,
                summary=output.summary,
                generated_at=output.generated_at,
                run_id=latest_analysis.run_id,
            )
            for output in latest_analysis.outputs
        ]

    def _build_provider_states(self, *, strategy_status) -> list[WorkflowProviderState]:
        generation = strategy_status.generation
        latest_artifact = strategy_status.latest_artifact
        items: list[WorkflowProviderState] = []
        for provider in strategy_status.providers:
            phase = generation.phase if generation.active_provider == provider.provider else "idle"
            if generation.active_provider == provider.provider:
                status = self._map_generation_status(generation.status)
                updated_at = generation.updated_at or generation.completed_at
                detail = generation.detail or provider.reason
                run_id = generation.run_id
            elif provider.available:
                status = "ready"
                updated_at = latest_artifact.created_at if latest_artifact and latest_artifact.effective_provider == provider.provider else None
                detail = provider.reason
                run_id = latest_artifact.run_id if latest_artifact and latest_artifact.effective_provider == provider.provider else None
            else:
                status = "degraded" if provider.availability == "fallback" else "failed"
                updated_at = None
                detail = provider.reason
                run_id = None
            artifact_count = 0
            if latest_artifact is not None and latest_artifact.effective_provider == provider.provider:
                artifact_count = len(latest_artifact.files)
            items.append(
                WorkflowProviderState(
                    provider=provider.provider,
                    label=provider.label,
                    status=status,
                    availability=provider.availability,
                    configured=provider.configured,
                    effective=provider.effective,
                    phase=phase,
                    detail=detail,
                    command=provider.command,
                    updated_at=updated_at,
                    run_id=run_id,
                    artifact_count=artifact_count,
                )
            )
        return items

    def _build_notices(
        self,
        *,
        market_snapshot_response,
        strategy_status,
        execution_status,
        risk_status,
    ) -> list[WorkflowNotice]:
        notices: list[WorkflowNotice] = []
        market_data = market_snapshot_response.market_data
        if market_data.status in {"degraded", "fallback"} and market_data.detail:
            notices.append(
                WorkflowNotice(
                    key="market",
                    title="Market runtime degraded",
                    detail=market_data.detail,
                    severity="warning",
                )
            )
        if execution_status.adapter_runtime.status in {"offline", "degraded"}:
            notices.append(
                WorkflowNotice(
                    key="execution",
                    title="Execution adapter attention",
                    detail=execution_status.adapter_runtime.last_error or execution_status.adapter_runtime.detail,
                    severity="danger" if execution_status.adapter_runtime.status == "offline" else "warning",
                )
            )
        if risk_status.halted:
            notices.append(
                WorkflowNotice(
                    key="risk",
                    title="Risk halt engaged",
                    detail=risk_status.halt_reason or "Risk halt is active.",
                    severity="danger",
                )
            )
        if strategy_status.enabled and strategy_status.reason and strategy_status.effective_provider != strategy_status.configured_provider:
            notices.append(
                WorkflowNotice(
                    key="strategy",
                    title="Strategy provider fallback",
                    detail=strategy_status.reason,
                    severity="warning",
                )
            )
        if strategy_status.generation.status in {"failed", "timeout"} and strategy_status.generation.detail:
            notices.append(
                WorkflowNotice(
                    key="strategy-run",
                    title="Strategy generation failed",
                    detail=strategy_status.generation.detail,
                    severity="danger",
                )
            )
        return notices

    def _resolve_current_run_id(
        self,
        *,
        symbol: str,
        timeframe: str,
        latest_analysis: AnalysisRunResult | None,
        strategy_status,
        execution_status,
        paper_report: PerformanceReport,
    ) -> str | None:
        ledger_run_id = self._run_ledger.latest_run_id(symbol=symbol, timeframe=timeframe)
        if ledger_run_id:
            return ledger_run_id
        latest_order = execution_status.recent_orders[0] if execution_status.recent_orders else None
        if latest_order is not None and latest_order.symbol == symbol and latest_order.timeframe == timeframe:
            return latest_order.run_id
        if (
            strategy_status.generation.run_id
            and strategy_status.generation.symbol == symbol
            and strategy_status.generation.timeframe == timeframe
        ):
            return strategy_status.generation.run_id
        if latest_analysis is not None and latest_analysis.symbol == symbol and latest_analysis.timeframe == timeframe:
            return latest_analysis.run_id
        if execution_status.last_run_id:
            return execution_status.last_run_id
        if paper_report.latest_run_id:
            return paper_report.latest_run_id
        if paper_report.latest_trade is not None:
            return paper_report.latest_trade.run_id
        return None

    def _resolve_active_stage_key(
        self,
        *,
        stages: dict[WorkflowStageKey, WorkflowStageState],
        current_run_id: str | None,
    ) -> WorkflowStageKey | None:
        priority: tuple[WorkflowStageKey, ...] = (
            "strategy",
            "execution",
            "analysis",
            "risk",
            "performance",
            "market",
        )
        for key in priority:
            if stages[key].status in {"running", "blocked", "failed", "degraded"}:
                return key
        if current_run_id is not None:
            correlated = [
                (stage.updated_at, key)
                for key, stage in stages.items()
                if key != "market"
                and stage.run_id == current_run_id
                and stage.updated_at is not None
                and stage.status in {"completed", "ready"}
            ]
            if correlated:
                correlated.sort()
                return correlated[-1][1]
        ranked = [
            (stage.updated_at, key)
            for key, stage in stages.items()
            if stage.updated_at is not None and stage.status in {"completed", "ready"}
        ]
        if not ranked:
            return None
        ranked.sort()
        return ranked[-1][1]

    def _resolve_current_handoff(
        self,
        *,
        active_stage_key: WorkflowStageKey | None,
        stages: dict[WorkflowStageKey, WorkflowStageState],
        current_run_id: str | None,
    ) -> str | None:
        if active_stage_key is None:
            return None
        if current_run_id is not None and active_stage_key not in {"market", "risk"}:
            ledger_record = self._run_ledger.latest_stage_record(current_run_id, active_stage_key)
            if ledger_record is not None and ledger_record.detail:
                return ledger_record.detail
        stage = stages[active_stage_key]
        if stage.detail:
            return stage.detail
        if stage.actor:
            return f"{stage.label} is owned by {stage.actor}."
        return None

    def _map_generation_status(self, status: str) -> WorkflowStageStatus:
        mapping: dict[str, WorkflowStageStatus] = {
            "idle": "ready",
            "running": "running",
            "completed": "completed",
            "failed": "failed",
            "timeout": "failed",
        }
        return mapping.get(status, "degraded")

    def _latest_event_time(
        self,
        *,
        recent_events: list[EventEnvelope],
        prefix: str,
    ) -> datetime | None:
        for event in recent_events:
            if event.event_type.startswith(prefix):
                return event.generated_at
        return None

    def _role_label(self, role: str) -> str:
        mapping = {
            "data": "Data",
            "technical_analysis": "Technical",
            "news_geopolitics": "Macro / News",
            "risk_decision": "Risk",
        }
        return mapping.get(role, role)
