from __future__ import annotations

from datetime import datetime, timezone
from threading import Lock

from app.models.run_ledger import (
    RunLedgerRecord,
    RunLedgerStage,
    RunLedgerStatus,
)


class RunLedgerService:
    def __init__(self) -> None:
        self._lock = Lock()
        self._records_by_run: dict[str, list[RunLedgerRecord]] = {}
        self._latest_run_by_focus: dict[str, str] = {}

    def append(self, record: RunLedgerRecord) -> RunLedgerRecord:
        focus_key = self._focus_key(record.symbol, record.timeframe)
        with self._lock:
            self._records_by_run.setdefault(record.run_id, []).append(record)
            self._latest_run_by_focus[focus_key] = record.run_id
        return record

    def append_stage(
        self,
        *,
        run_id: str,
        symbol: str,
        timeframe: str,
        stage: RunLedgerStage,
        status: RunLedgerStatus,
        detail: str | None = None,
        actor: str | None = None,
        generated_at: datetime | None = None,
        metadata: dict[str, str] | None = None,
    ) -> RunLedgerRecord:
        return self.append(
            RunLedgerRecord(
                run_id=run_id,
                symbol=symbol,
                timeframe=timeframe,
                stage=stage,
                status=status,
                detail=detail,
                actor=actor,
                generated_at=generated_at or datetime.now(timezone.utc),
                metadata=metadata or {},
            )
        )

    def latest_run_id(self, *, symbol: str, timeframe: str) -> str | None:
        with self._lock:
            return self._latest_run_by_focus.get(self._focus_key(symbol, timeframe))

    def records_for_run(self, run_id: str) -> list[RunLedgerRecord]:
        with self._lock:
            return list(self._records_by_run.get(run_id, []))

    def latest_stage_record(
        self,
        run_id: str,
        stage: RunLedgerStage,
    ) -> RunLedgerRecord | None:
        with self._lock:
            records = self._records_by_run.get(run_id, [])
            for record in reversed(records):
                if record.stage == stage:
                    return record
        return None

    def latest_record_for_focus(
        self,
        *,
        symbol: str,
        timeframe: str,
        stage: RunLedgerStage | None = None,
    ) -> RunLedgerRecord | None:
        run_id = self.latest_run_id(symbol=symbol, timeframe=timeframe)
        if run_id is None:
            return None
        if stage is None:
            records = self.records_for_run(run_id)
            return records[-1] if records else None
        return self.latest_stage_record(run_id, stage)

    def _focus_key(self, symbol: str, timeframe: str) -> str:
        return f"{symbol}:{timeframe}"
