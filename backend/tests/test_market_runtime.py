from pathlib import Path

from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app


def configure_market_env(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("APP_MODE", "mock")
    monkeypatch.setenv("AI_PROVIDER", "mock")
    monkeypatch.delenv("AI_API_KEY", raising=False)
    monkeypatch.delenv("AI_BASE_URL", raising=False)
    monkeypatch.delenv("AI_MODEL", raising=False)
    monkeypatch.setenv("MARKET_SYMBOLS", "BTC/USDT")
    monkeypatch.setenv("MARKET_TIMEFRAMES", "1m")
    monkeypatch.setenv("MARKET_HISTORY_LIMIT", "4")
    monkeypatch.setenv("MARKET_STREAM_ENABLED", "false")
    monkeypatch.setenv("EVENT_LOG_DIR", str(tmp_path / "events"))
    get_settings.cache_clear()


def test_market_snapshot_route_returns_normalized_data(monkeypatch, tmp_path: Path) -> None:
    configure_market_env(monkeypatch, tmp_path)

    with TestClient(app) as client:
        response = client.get("/api/market/snapshot")

    assert response.status_code == 200
    payload = response.json()
    assert payload["runtime"]["runtime_mode"] == "mock-safe"
    assert len(payload["snapshots"]) == 1
    snapshot = payload["snapshots"][0]
    assert snapshot["symbol"] == "BTC/USDT"
    assert snapshot["timeframe"] == "1m"
    assert snapshot["source"] == "mock"
    assert len(snapshot["candles"]) == 4

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
