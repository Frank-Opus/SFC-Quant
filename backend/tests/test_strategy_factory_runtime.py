import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app


def configure_strategy_env(monkeypatch, tmp_path: Path) -> Path:
    workspace = tmp_path / "strategy_factory"
    monkeypatch.setenv("APP_MODE", "mock")
    monkeypatch.setenv("AI_PROVIDER", "mock")
    monkeypatch.setenv("MARKET_SYMBOLS", "BTC/USDT")
    monkeypatch.setenv("MARKET_TIMEFRAMES", "1m")
    monkeypatch.setenv("MARKET_HISTORY_LIMIT", "4")
    monkeypatch.setenv("MARKET_STREAM_ENABLED", "false")
    monkeypatch.setenv("EVENT_LOG_DIR", str(tmp_path / "events"))
    monkeypatch.setenv("STRATEGY_FACTORY_ENABLED", "true")
    monkeypatch.setenv("STRATEGY_FACTORY_PROVIDER", "mock_rdq")
    monkeypatch.setenv("STRATEGY_FACTORY_WORKSPACE", str(workspace))
    get_settings.cache_clear()
    return workspace


def test_strategy_factory_status_and_config_route(monkeypatch, tmp_path: Path) -> None:
    workspace = configure_strategy_env(monkeypatch, tmp_path)

    with TestClient(app) as client:
        status_response = client.get("/api/strategy/status")
        disable_response = client.post("/api/strategy/config", json={"enabled": False})
        enable_response = client.post(
            "/api/strategy/config",
            json={"enabled": True, "provider": "rd_agent_q"},
        )

    assert status_response.status_code == 200
    assert status_response.json()["enabled"] is True
    assert status_response.json()["workspace"] == str(workspace.resolve())
    assert disable_response.status_code == 200
    assert disable_response.json()["enabled"] is False
    assert enable_response.status_code == 200
    assert enable_response.json()["enabled"] is True
    assert enable_response.json()["configured_provider"] == "rd_agent_q"
    assert enable_response.json()["effective_provider"] == "mock_rdq"

    get_settings.cache_clear()


def test_strategy_generation_writes_reviewable_artifacts(monkeypatch, tmp_path: Path) -> None:
    workspace = configure_strategy_env(monkeypatch, tmp_path)

    with TestClient(app) as client:
        analysis_response = client.post(
            "/api/analysis/run",
            json={"symbol": "BTC/USDT", "timeframe": "1m", "notes": "phase-8"},
        )
        generate_response = client.post(
            "/api/strategy/generate",
            json={"symbol": "BTC/USDT", "timeframe": "1m", "notes": "review artifact"},
        )
        artifacts_response = client.get(
            "/api/strategy/artifacts",
            params={"symbol": "BTC/USDT", "timeframe": "1m", "limit": 5},
        )

    assert analysis_response.status_code == 200
    assert generate_response.status_code == 200
    payload = generate_response.json()
    artifact = payload["artifact"]
    artifact_dir = Path(artifact["directory"])
    assert artifact_dir.exists()
    assert artifact_dir.parent == workspace.resolve()
    assert {Path(item["path"]).name for item in artifact["files"]} == {
        "strategy.md",
        "strategy.json",
        "strategy.py",
    }
    for file_payload in artifact["files"]:
        assert Path(file_payload["path"]).exists()

    manifest = json.loads((artifact_dir / "strategy.json").read_text())
    assert manifest["artifact_id"] == artifact["artifact_id"]
    assert manifest["symbol"] == "BTC/USDT"
    assert artifacts_response.status_code == 200
    assert len(artifacts_response.json()) >= 1
    assert artifacts_response.json()[0]["artifact_id"] == artifact["artifact_id"]

    get_settings.cache_clear()


def test_strategy_generation_requires_existing_analysis(monkeypatch, tmp_path: Path) -> None:
    configure_strategy_env(monkeypatch, tmp_path)

    with TestClient(app) as client:
        response = client.post(
            "/api/strategy/generate",
            json={"symbol": "BTC/USDT", "timeframe": "1m"},
        )

    assert response.status_code == 404
    assert "Run analysis first" in response.json()["detail"]

    get_settings.cache_clear()
