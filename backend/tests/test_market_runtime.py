from datetime import datetime, timezone
from pathlib import Path

from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app
from app.models.market import Candle, MarketSnapshot
from app.services.market import CcxtMarketDataAdapter


def configure_market_env(
    monkeypatch,
    tmp_path: Path,
    *,
    market_data_mode: str | None = "mock",
) -> None:
    monkeypatch.setenv("APP_MODE", "mock")
    monkeypatch.setenv("AI_PROVIDER", "mock")
    monkeypatch.delenv("AI_API_KEY", raising=False)
    monkeypatch.delenv("AI_BASE_URL", raising=False)
    monkeypatch.delenv("AI_MODEL", raising=False)
    if market_data_mode is None:
        monkeypatch.delenv("MARKET_DATA_MODE", raising=False)
    else:
        monkeypatch.setenv("MARKET_DATA_MODE", market_data_mode)
    monkeypatch.setenv("MARKET_SYMBOLS", "BTC/USDT")
    monkeypatch.setenv("MARKET_TIMEFRAMES", "1m")
    monkeypatch.setenv("MARKET_HISTORY_LIMIT", "4")
    monkeypatch.setenv("MARKET_STREAM_ENABLED", "false")
    monkeypatch.setenv("EVENT_LOG_DIR", str(tmp_path / "events"))
    get_settings.cache_clear()


def _build_real_snapshot() -> MarketSnapshot:
    now = datetime.now(timezone.utc)
    candles = [
        Candle(
            timestamp=now,
            open=50000.0,
            high=50100.0,
            low=49900.0,
            close=50080.0,
            volume=120.0,
        )
        for _ in range(4)
    ]
    return MarketSnapshot(
        symbol="BTC/USDT",
        timeframe="1m",
        exchange_id="binance",
        source="ccxt",
        generated_at=now,
        last_price=50080.0,
        change_percent=0.5,
        volume_24h=120000.0,
        candles=candles,
    )


def test_market_snapshot_route_defaults_to_real_mode_and_reports_degraded_when_exchange_unavailable(
    monkeypatch,
    tmp_path: Path,
) -> None:
    configure_market_env(monkeypatch, tmp_path, market_data_mode=None)

    async def _raise_fetch(*args, **kwargs):
        raise RuntimeError("ccxt offline in test")

    monkeypatch.setattr(CcxtMarketDataAdapter, "fetch_market_snapshot", _raise_fetch)

    with TestClient(app) as client:
        response = client.get("/api/market/snapshot")

    assert response.status_code == 200
    payload = response.json()
    assert payload["runtime"]["market_data"]["mode"] == "real"
    assert payload["runtime"]["market_data"]["requested_source"] == "ccxt"
    assert payload["runtime"]["market_data"]["effective_source"] == "unavailable"
    assert payload["runtime"]["market_data"]["status"] == "degraded"
    assert payload["runtime"]["market_data"]["fallback_active"] is False
    assert payload["market_data"]["status"] == "degraded"
    assert payload["market_data"]["effective_source"] == "unavailable"
    assert payload["snapshots"] == []
    assert "no mock fallback in real mode" in payload["runtime"]["market_data"]["detail"].lower()

    get_settings.cache_clear()


def test_market_snapshot_route_explicit_mock_mode_still_returns_mock_data(
    monkeypatch, tmp_path: Path
) -> None:
    configure_market_env(monkeypatch, tmp_path, market_data_mode="mock")

    with TestClient(app) as client:
        response = client.get("/api/market/snapshot")

    assert response.status_code == 200
    payload = response.json()
    assert payload["runtime"]["runtime_mode"] == "mock-safe"
    assert payload["runtime"]["market_data"]["mode"] == "mock"
    assert payload["runtime"]["market_data"]["requested_source"] == "mock"
    assert payload["runtime"]["market_data"]["effective_source"] == "mock"
    assert payload["runtime"]["market_data"]["status"] == "mock"
    assert payload["runtime"]["market_data"]["fallback_active"] is False
    assert payload["market_data"]["status"] == "mock"
    assert len(payload["snapshots"]) == 1
    snapshot = payload["snapshots"][0]
    assert snapshot["symbol"] == "BTC/USDT"
    assert snapshot["timeframe"] == "1m"
    assert snapshot["source"] == "mock"
    assert len(snapshot["candles"]) == 4

    get_settings.cache_clear()


def test_market_snapshot_real_mode_returns_ccxt_data(monkeypatch, tmp_path: Path) -> None:
    configure_market_env(monkeypatch, tmp_path, market_data_mode="real")

    async def _fetch_real_snapshot(*args, **kwargs):
        return _build_real_snapshot()

    monkeypatch.setattr(CcxtMarketDataAdapter, "fetch_market_snapshot", _fetch_real_snapshot)

    with TestClient(app) as client:
        response = client.get("/api/market/snapshot")

    assert response.status_code == 200
    payload = response.json()
    assert payload["runtime"]["market_data"]["mode"] == "real"
    assert payload["runtime"]["market_data"]["requested_source"] == "ccxt"
    assert payload["runtime"]["market_data"]["effective_source"] == "ccxt"
    assert payload["runtime"]["market_data"]["status"] == "live"
    assert payload["runtime"]["market_data"]["fallback_active"] is False
    assert payload["market_data"]["status"] == "live"
    assert payload["snapshots"][0]["source"] == "ccxt"

    get_settings.cache_clear()


def test_market_snapshot_real_mode_failure_does_not_masquerade_mock(monkeypatch, tmp_path: Path) -> None:
    configure_market_env(monkeypatch, tmp_path, market_data_mode="real")

    async def _raise_fetch(*args, **kwargs):
        raise RuntimeError("ccxt offline in test")

    monkeypatch.setattr(CcxtMarketDataAdapter, "fetch_market_snapshot", _raise_fetch)

    with TestClient(app) as client:
        response = client.get("/api/market/snapshot")

    assert response.status_code == 200
    payload = response.json()
    assert payload["runtime"]["market_data"]["mode"] == "real"
    assert payload["runtime"]["market_data"]["requested_source"] == "ccxt"
    assert payload["runtime"]["market_data"]["effective_source"] == "unavailable"
    assert payload["runtime"]["market_data"]["status"] == "degraded"
    assert payload["runtime"]["market_data"]["fallback_active"] is False
    assert payload["market_data"]["status"] == "degraded"
    assert payload["snapshots"] == []
    assert "no mock fallback in real mode" in payload["runtime"]["market_data"]["detail"].lower()

    get_settings.cache_clear()


def test_recent_events_are_persisted_to_jsonl(monkeypatch, tmp_path: Path) -> None:
    configure_market_env(monkeypatch, tmp_path)

    with TestClient(app) as client:
        response = client.get("/api/events/recent", params={"limit": 5})

    assert response.status_code == 200
    payload = response.json()
    assert payload
    assert payload[0]["event_type"] == "market.tick"

    event_log = tmp_path / "events" / "market-events.jsonl"
    assert event_log.exists()
    contents = event_log.read_text(encoding="utf-8")
    assert "market.tick" in contents

    get_settings.cache_clear()


def test_websocket_receives_initial_snapshot(monkeypatch, tmp_path: Path) -> None:
    configure_market_env(monkeypatch, tmp_path)

    with TestClient(app) as client:
        with client.websocket_connect("/ws") as websocket:
            connected_event = websocket.receive_json()
            snapshot_event = websocket.receive_json()

    assert connected_event["event_type"] == "system.connected"
    assert snapshot_event["event_type"] == "market.snapshot"
    assert snapshot_event["payload"]["snapshots"][0]["symbol"] == "BTC/USDT"

    get_settings.cache_clear()
