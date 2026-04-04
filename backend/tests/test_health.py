from pathlib import Path

from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app
from app.services.market import CcxtMarketDataAdapter


def test_health_reports_mock_safe_when_requested(monkeypatch) -> None:
    for key in (
        "APP_MODE",
        "LIVE_TRADING_ENABLED",
        "AI_PROVIDER",
        "AI_API_KEY",
        "AI_BASE_URL",
        "AI_MODEL",
        "EXCHANGE_API_KEY",
        "EXCHANGE_API_SECRET",
    ):
        monkeypatch.delenv(key, raising=False)

    monkeypatch.setenv("MARKET_DATA_MODE", "mock")
    get_settings.cache_clear()

    with TestClient(app) as client:
        response = client.get("/health")
        live_response = client.get("/health/live")
        ready_response = client.get("/health/ready")
        diagnostics_response = client.get("/api/diagnostics/summary")

    assert response.status_code == 200

    payload = response.json()
    assert payload["name"] == "dSFC-Quant"
    assert payload["status"] == "ok"
    assert payload["service"] == "backend"
    assert payload["runtime_mode"] == "mock-safe"
    assert payload["live_trading_enabled"] is False
    assert payload["app_mode"] == "mock"
    assert payload["execution_mode"] == "paper"
    assert payload["execution_adapter"] == "freqtrade_mock"
    assert payload["market_data"]["mode"] == "mock"
    assert payload["market_data"]["requested_source"] == "mock"
    assert payload["market_data"]["effective_source"] == "mock"
    assert payload["market_data"]["status"] == "mock"
    assert payload["market_data"]["fallback_active"] is False
    assert live_response.status_code == 200
    assert live_response.json()["status"] == "ok"
    assert ready_response.status_code == 200
    assert ready_response.json()["service"] == "backend"
    assert ready_response.json()["checks"]
    assert diagnostics_response.status_code == 200
    assert diagnostics_response.json()["runtime"]["runtime_mode"] == "mock-safe"
    assert diagnostics_response.json()["runtime"]["market_data"]["status"] == "mock"
    assert diagnostics_response.json()["market_data"]["requested_source"] == "mock"

    get_settings.cache_clear()


def test_health_reports_default_real_mode_startup_truth_when_exchange_unavailable(
    monkeypatch, tmp_path: Path
) -> None:
    for key in (
        "APP_MODE",
        "LIVE_TRADING_ENABLED",
        "AI_PROVIDER",
        "AI_API_KEY",
        "AI_BASE_URL",
        "AI_MODEL",
        "EXCHANGE_API_KEY",
        "EXCHANGE_API_SECRET",
    ):
        monkeypatch.delenv(key, raising=False)

    monkeypatch.setenv("MARKET_STREAM_ENABLED", "false")
    monkeypatch.setenv("EVENT_LOG_DIR", str(tmp_path / "events"))

    async def _raise_fetch(*args, **kwargs):
        raise RuntimeError("exchange offline in health test")

    monkeypatch.setattr(CcxtMarketDataAdapter, "fetch_market_snapshot", _raise_fetch)

    get_settings.cache_clear()

    with TestClient(app) as client:
        response = client.get("/health")
        ready_response = client.get("/health/ready")
        diagnostics_response = client.get("/api/diagnostics/summary")

    assert response.status_code == 200
    payload = response.json()
    assert payload["execution_mode"] == "paper"
    assert payload["market_data"]["mode"] == "real"
    assert payload["market_data"]["requested_source"] == "ccxt"
    assert payload["market_data"]["effective_source"] == "unavailable"
    assert payload["market_data"]["status"] == "degraded"
    assert payload["market_data"]["fallback_active"] is False
    assert "no mock fallback in real mode" in payload["market_data"]["detail"].lower()

    assert ready_response.status_code == 200
    ready_payload = ready_response.json()
    assert ready_payload["status"] == "degraded"
    market_check = next(check for check in ready_payload["checks"] if check["name"] == "market_snapshots")
    assert market_check["status"] == "degraded"

    assert diagnostics_response.status_code == 200
    diagnostics_payload = diagnostics_response.json()
    assert diagnostics_payload["runtime"]["market_data"]["mode"] == "real"
    assert diagnostics_payload["runtime"]["market_data"]["status"] == "degraded"
    assert diagnostics_payload["market_data"]["effective_source"] == "unavailable"
    assert diagnostics_payload["market_data"]["status"] == "degraded"

    get_settings.cache_clear()
