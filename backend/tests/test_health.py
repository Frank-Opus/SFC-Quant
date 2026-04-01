from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app


def test_health_reports_mock_safe_defaults(monkeypatch) -> None:
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
    assert live_response.status_code == 200
    assert live_response.json()["status"] == "ok"
    assert ready_response.status_code == 200
    assert ready_response.json()["service"] == "backend"
    assert ready_response.json()["checks"]
    assert diagnostics_response.status_code == 200
    assert diagnostics_response.json()["runtime"]["runtime_mode"] == "mock-safe"

    get_settings.cache_clear()
