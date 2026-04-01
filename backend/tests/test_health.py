from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app


def test_health_reports_mock_safe_defaults(monkeypatch) -> None:
    for key in (
        "APP_MODE",
        "LIVE_TRADING_ENABLED",
        "AI_PROVIDER",
        "AI_API_KEY",
        "EXCHANGE_API_KEY",
        "EXCHANGE_API_SECRET",
    ):
        monkeypatch.delenv(key, raising=False)

    get_settings.cache_clear()

    client = TestClient(app)
    response = client.get("/health")

    assert response.status_code == 200

    payload = response.json()
    assert payload["service"] == "backend"
    assert payload["runtime_mode"] == "mock-safe"
    assert payload["live_trading_enabled"] is False
    assert payload["app_mode"] == "mock"

    get_settings.cache_clear()

