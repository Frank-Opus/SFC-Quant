import asyncio
import math
import os
import time
from datetime import datetime, timedelta, timezone
from typing import Protocol

from app.core.config import Settings
from app.core.runtime import MarketDataRuntime, resolve_runtime
from app.models.events import EventEnvelope, MarketSnapshotResponse
from app.models.market import Candle, MarketSnapshot
from app.services.event_bus import EventBus

try:
    import ccxt  # type: ignore
except ImportError:  # pragma: no cover - optional dependency during local tests
    ccxt = None


class MarketDataAdapter(Protocol):
    async def fetch_market_snapshot(
        self,
        *,
        symbol: str,
        timeframe: str,
        history_limit: int,
        exchange_id: str,
    ) -> MarketSnapshot:
        ...


class MockMarketDataAdapter:
    async def fetch_market_snapshot(
        self,
        *,
        symbol: str,
        timeframe: str,
        history_limit: int,
        exchange_id: str,
    ) -> MarketSnapshot:
        now = datetime.now(timezone.utc)
        seconds = _timeframe_seconds(timeframe)
        seed = sum(ord(char) for char in f"{symbol}:{timeframe}")
        minute_bucket = int(now.timestamp() // seconds)
        base_price = 18000 + (seed % 5000)
        drift = math.sin((minute_bucket + seed) / 5) * 180
        trend = ((minute_bucket + seed) % 19) * 3.5
        last_price = round(base_price + drift + trend, 2)
        previous_price = round(last_price - math.cos((minute_bucket + seed) / 4) * 42, 2)

        candles: list[Candle] = []
        for offset in range(history_limit):
            step = history_limit - offset - 1
            bucket_time = now - timedelta(seconds=seconds * step)
            anchor = minute_bucket - step
            open_price = base_price + math.sin((anchor + seed) / 6) * 150 + (anchor % 11) * 2
            close_price = open_price + math.cos((anchor + seed) / 7) * 34
            high_price = max(open_price, close_price) + 14 + (seed % 7)
            low_price = min(open_price, close_price) - 14 - (seed % 5)
            volume = 900 + ((anchor + seed) % 23) * 37
            candles.append(
                Candle(
                    timestamp=bucket_time,
                    open=round(open_price, 2),
                    high=round(high_price, 2),
                    low=round(low_price, 2),
                    close=round(close_price, 2),
                    volume=float(round(volume, 2)),
                )
            )

        change_percent = 0.0
        if previous_price:
            change_percent = round(((last_price - previous_price) / previous_price) * 100, 2)

        return MarketSnapshot(
            symbol=symbol,
            timeframe=timeframe,
            exchange_id=exchange_id,
            source="mock",
            generated_at=now,
            last_price=last_price,
            change_percent=change_percent,
            volume_24h=float(round(42000 + ((minute_bucket + seed) % 43) * 320, 2)),
            candles=candles,
        )


class CcxtMarketDataAdapter:
    async def fetch_market_snapshot(
        self,
        *,
        symbol: str,
        timeframe: str,
        history_limit: int,
        exchange_id: str,
    ) -> MarketSnapshot:
        if ccxt is None:
            raise RuntimeError("ccxt is not installed")

        exchange_class = getattr(ccxt, exchange_id, None)
        if exchange_class is None:
            raise RuntimeError(f"Unsupported exchange adapter: {exchange_id}")

        records = await asyncio.to_thread(
            _fetch_ohlcv_records,
            exchange_class,
            symbol,
            timeframe,
            history_limit,
        )

        candles = [
            Candle(
                timestamp=datetime.fromtimestamp(record[0] / 1000, tz=timezone.utc),
                open=float(record[1]),
                high=float(record[2]),
                low=float(record[3]),
                close=float(record[4]),
                volume=float(record[5]),
            )
            for record in records
        ]

        if not candles:
            raise RuntimeError(f"No market data returned for {symbol} {timeframe}")

        last_candle = candles[-1]
        previous_close = candles[-2].close if len(candles) > 1 else last_candle.close
        change_percent = 0.0
        if previous_close:
            change_percent = round(((last_candle.close - previous_close) / previous_close) * 100, 2)

        return MarketSnapshot(
            symbol=symbol,
            timeframe=timeframe,
            exchange_id=exchange_id,
            source="ccxt",
            generated_at=datetime.now(timezone.utc),
            last_price=last_candle.close,
            change_percent=change_percent,
            volume_24h=float(sum(candle.volume for candle in candles)),
            candles=candles,
        )


class MarketRuntimeService:
    def __init__(
        self,
        settings: Settings,
        event_bus: EventBus,
    ) -> None:
        self._settings = settings
        self._event_bus = event_bus
        self._mock_adapter = MockMarketDataAdapter()
        self._exchange_adapter = CcxtMarketDataAdapter()
        self._latest: dict[str, MarketSnapshot] = {}
        self._refresh_lock = asyncio.Lock()
        self._stream_task: asyncio.Task | None = None
        self._shutdown = asyncio.Event()
        self._last_market_error_detail: str | None = None

    @property
    def event_log_path(self) -> str:
        return self._event_bus.event_log_path

    async def initialize(self) -> None:
        await self.refresh_once()
        if self._settings.market_stream_enabled:
            self._stream_task = asyncio.create_task(self._stream_loop())

    async def shutdown(self) -> None:
        self._shutdown.set()
        if self._stream_task is not None:
            self._stream_task.cancel()
            try:
                await self._stream_task
            except asyncio.CancelledError:
                pass

    async def refresh_once(self) -> list[MarketSnapshot]:
        async with self._refresh_lock:
            snapshots: list[MarketSnapshot] = []
            refresh_error_detail: str | None = None
            for symbol in self._settings.market_symbols:
                for timeframe in self._settings.market_timeframes:
                    key = f"{symbol}:{timeframe}"
                    try:
                        snapshot = await self.ensure_snapshot(
                            symbol=symbol,
                            timeframe=timeframe,
                            force_refresh=True,
                        )
                        snapshots.append(snapshot)
                    except RuntimeError as exc:
                        refresh_error_detail = str(exc)
                        cached = self._latest.get(key)
                        if cached and (
                            self._settings.market_data_mode != "real"
                            or cached.source == "ccxt"
                        ):
                            snapshots.append(cached)
                        continue

            if self._settings.market_data_mode == "real":
                self._last_market_error_detail = refresh_error_detail
            else:
                self._last_market_error_detail = None
            return snapshots

    async def ensure_snapshot(
        self,
        *,
        symbol: str,
        timeframe: str,
        force_refresh: bool = False,
    ) -> MarketSnapshot:
        key = f"{symbol}:{timeframe}"
        if not force_refresh and key in self._latest:
            return self._latest[key]

        try:
            snapshot = await self._fetch_snapshot(symbol=symbol, timeframe=timeframe)
        except RuntimeError:
            cached = self._latest.get(key)
            if cached and (
                self._settings.market_data_mode != "real"
                or cached.source == "ccxt"
            ):
                return cached
            raise
        self._latest[key] = snapshot
        await self._record_event(
            event_type="market.tick",
            payload=snapshot.model_dump(mode="json"),
        )
        return snapshot

    async def build_fallback_snapshot(
        self,
        *,
        symbol: str,
        timeframe: str,
    ) -> MarketSnapshot:
        return await self._mock_adapter.fetch_market_snapshot(
            symbol=symbol,
            timeframe=timeframe,
            history_limit=self._settings.market_history_limit,
            exchange_id=self._settings.exchange_id,
        )

    def market_data_runtime(self) -> MarketDataRuntime:
        requested_source = "ccxt" if self._settings.market_data_mode == "real" else "mock"
        mode = self._settings.market_data_mode

        if requested_source == "mock":
            return MarketDataRuntime(
                mode=mode,
                requested_source=requested_source,
                effective_source="mock",
                status="mock",
                fallback_active=False,
                detail="Mock market data mode active.",
            )

        if not self._latest:
            if self._last_market_error_detail:
                return MarketDataRuntime(
                    mode=mode,
                    requested_source=requested_source,
                    effective_source="unavailable",
                    status="degraded",
                    fallback_active=False,
                    detail=self._last_market_error_detail,
                )
            return MarketDataRuntime(
                mode=mode,
                requested_source=requested_source,
                effective_source="unknown",
                status="pending",
                fallback_active=False,
                detail="Real market mode requested; awaiting market runtime refresh.",
            )

        sources = {snapshot.source for snapshot in self._latest.values()}
        if sources == {"ccxt"}:
            if self._last_market_error_detail:
                return MarketDataRuntime(
                    mode=mode,
                    requested_source=requested_source,
                    effective_source="ccxt",
                    status="fallback",
                    fallback_active=True,
                    detail=self._last_market_error_detail,
                )
            return MarketDataRuntime(
                mode=mode,
                requested_source=requested_source,
                effective_source="ccxt",
                status="live",
                fallback_active=False,
                detail="Real market data is active via ccxt.",
            )

        if "mock" in sources:
            return MarketDataRuntime(
                mode=mode,
                requested_source=requested_source,
                effective_source="mock",
                status="degraded",
                fallback_active=False,
                detail=(
                    self._last_market_error_detail
                    or (
                        "Real market mode requested but cached snapshots are mock-only; "
                        "refusing to treat mock data as live market data."
                    )
                ),
            )

        return MarketDataRuntime(
            mode=mode,
            requested_source=requested_source,
            effective_source="unknown",
            status="degraded",
            fallback_active=False,
            detail="Market runtime sources are in an unexpected state.",
        )

    def status(self) -> MarketDataRuntime:
        return self.market_data_runtime()

    def snapshot_response(self, limit: int = 12) -> MarketSnapshotResponse:
        market_data = self.market_data_runtime()
        runtime = resolve_runtime(self._settings, market_data=market_data)
        snapshots = list(self._latest.values())
        recent_events = self._event_bus.get_recent_events(limit=limit)
        generated_at = max(
            (snapshot.generated_at for snapshot in snapshots),
            default=datetime.now(timezone.utc),
        )
        return MarketSnapshotResponse(
            generated_at=generated_at,
            runtime=runtime,
            market_data=market_data,
            snapshots=snapshots,
            recent_events=recent_events,
        )

    async def _stream_loop(self) -> None:
        while not self._shutdown.is_set():
            try:
                await asyncio.wait_for(
                    self._shutdown.wait(),
                    timeout=self._settings.market_poll_interval_seconds,
                )
            except asyncio.TimeoutError:
                await self.refresh_once()

    async def _fetch_snapshot(self, *, symbol: str, timeframe: str) -> MarketSnapshot:
        use_real_market = self._settings.market_data_mode == "real"
        if use_real_market:
            try:
                return await self._exchange_adapter.fetch_market_snapshot(
                    symbol=symbol,
                    timeframe=timeframe,
                    history_limit=self._settings.market_history_limit,
                    exchange_id=self._settings.exchange_id,
                )
            except Exception as exc:  # pragma: no cover - depends on external services
                self._last_market_error_detail = (
                    f"Exchange adapter unavailable for {symbol} {timeframe}; "
                    f"real snapshot unavailable (no mock fallback in real mode). detail={exc}"
                )
                await self._record_event(
                    event_type="system.warning",
                    payload={
                        "message": "Exchange adapter unavailable in real mode; real snapshot refresh failed.",
                        "detail": str(exc),
                        "symbol": symbol,
                        "timeframe": timeframe,
                        "market_data_mode": self._settings.market_data_mode,
                    },
                )
                raise RuntimeError(self._last_market_error_detail) from exc
        else:
            self._last_market_error_detail = None

        return await self._mock_adapter.fetch_market_snapshot(
            symbol=symbol,
            timeframe=timeframe,
            history_limit=self._settings.market_history_limit,
            exchange_id=self._settings.exchange_id,
        )

    async def _record_event(self, *, event_type: str, payload: dict) -> None:
        await self._event_bus.publish(event_type=event_type, payload=payload)


def _fetch_ohlcv_records(exchange_class, symbol: str, timeframe: str, history_limit: int):
    proxy = (
        os.environ.get("HTTPS_PROXY")
        or os.environ.get("HTTP_PROXY")
        or os.environ.get("ALL_PROXY")
    )
    timeout_ms = int(os.environ.get("CCXT_TIMEOUT_MS", "30000"))
    retry_count = int(os.environ.get("CCXT_FETCH_RETRIES", "3"))
    last_error: Exception | None = None

    for attempt in range(retry_count):
        exchange = exchange_class({"enableRateLimit": True})
        exchange.timeout = timeout_ms
        if proxy:
            exchange.proxies = {"http": proxy, "https": proxy}
        try:
            return exchange.fetch_ohlcv(symbol, timeframe=timeframe, limit=history_limit)
        except Exception as exc:
            last_error = exc
            if attempt >= retry_count - 1:
                raise
            time.sleep(min(1.5 * (attempt + 1), 3.0))
        finally:
            close_method = getattr(exchange, "close", None)
            if callable(close_method):
                close_method()

    if last_error is not None:
        raise last_error
    raise RuntimeError(f"Failed to fetch market data for {symbol} {timeframe}")


def _timeframe_seconds(timeframe: str) -> int:
    if timeframe.endswith("m"):
        return int(timeframe[:-1]) * 60
    if timeframe.endswith("h"):
        return int(timeframe[:-1]) * 60 * 60
    if timeframe.endswith("d"):
        return int(timeframe[:-1]) * 60 * 60 * 24
    return 60
