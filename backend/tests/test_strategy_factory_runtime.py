import json
import threading
import time
from pathlib import Path

from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app
from app.services.strategy_factory import StrategyFactoryService


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


def write_fake_rd_agent(tmp_path: Path, filename: str = "fake_rd_agent.py") -> Path:
    script_path = tmp_path / filename
    script_path.write_text(
        "\n".join(
            [
                "#!/usr/bin/env python3",
                "import json",
                "import os",
                "from pathlib import Path",
                "",
                "artifact_dir = Path(os.environ['DSFC_STRATEGY_ARTIFACT_DIR'])",
                "input_path = Path(os.environ['DSFC_STRATEGY_INPUT_JSON'])",
                "payload = json.loads(input_path.read_text())",
                "generated_path = artifact_dir / 'rdagent-generated.md'",
                "generated_path.write_text(",
                "    f\"# RD-Agent Output\\n\\n{payload['symbol']} {payload['timeframe']}\\n\"",
                ")",
                "print(f\"generated {generated_path.name}\")",
                "",
            ]
        )
    )
    script_path.chmod(0o755)
    return script_path


def write_sleepy_rd_agent(tmp_path: Path, seconds: float = 1.0) -> Path:
    script_path = tmp_path / "sleepy_rd_agent.py"
    script_path.write_text(
        "\n".join(
            [
                "#!/usr/bin/env python3",
                "import time",
                f"time.sleep({seconds})",
                "print('done')",
            ]
        )
    )
    script_path.chmod(0o755)
    return script_path


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


def test_strategy_factory_reports_real_rd_agent_when_command_is_available(
    monkeypatch, tmp_path: Path
) -> None:
    workspace = configure_strategy_env(monkeypatch, tmp_path)
    fake_rd_agent = write_fake_rd_agent(tmp_path)
    monkeypatch.setenv("STRATEGY_FACTORY_PROVIDER", "rd_agent_q")
    monkeypatch.setenv("STRATEGY_FACTORY_RD_AGENT_COMMAND", str(fake_rd_agent))
    get_settings.cache_clear()

    with TestClient(app) as client:
        response = client.get("/api/strategy/status")

    assert response.status_code == 200
    assert response.json()["workspace"] == str(workspace.resolve())
    assert response.json()["configured_provider"] == "rd_agent_q"
    assert response.json()["effective_provider"] == "rd_agent_q"

    get_settings.cache_clear()


def test_strategy_factory_falls_back_when_native_rd_agent_lacks_docker_access(
    monkeypatch, tmp_path: Path
) -> None:
    workspace = configure_strategy_env(monkeypatch, tmp_path)
    fake_rd_agent = write_fake_rd_agent(tmp_path, filename="rdagent")
    monkeypatch.setenv("STRATEGY_FACTORY_PROVIDER", "rd_agent_q")
    monkeypatch.setenv("STRATEGY_FACTORY_RD_AGENT_COMMAND", str(fake_rd_agent))
    monkeypatch.setattr(StrategyFactoryService, "_rd_agent_has_docker_access", lambda self: False)
    get_settings.cache_clear()

    with TestClient(app) as client:
        response = client.get("/api/strategy/status")

    assert response.status_code == 200
    assert response.json()["workspace"] == str(workspace.resolve())
    assert response.json()["configured_provider"] == "rd_agent_q"
    assert response.json()["effective_provider"] == "mock_rdq"
    assert "Docker daemon access is unavailable" in response.json()["reason"]

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


def test_strategy_generation_runs_rd_agent_when_configured(monkeypatch, tmp_path: Path) -> None:
    workspace = configure_strategy_env(monkeypatch, tmp_path)
    fake_rd_agent = write_fake_rd_agent(tmp_path)
    monkeypatch.setenv("STRATEGY_FACTORY_PROVIDER", "rd_agent_q")
    monkeypatch.setenv("STRATEGY_FACTORY_RD_AGENT_COMMAND", str(fake_rd_agent))
    get_settings.cache_clear()

    with TestClient(app) as client:
        analysis_response = client.post(
            "/api/analysis/run",
            json={"symbol": "BTC/USDT", "timeframe": "1m", "notes": "rd-agent"},
        )
        generate_response = client.post(
            "/api/strategy/generate",
            json={"symbol": "BTC/USDT", "timeframe": "1m", "notes": "real rd-agent path"},
        )

    assert analysis_response.status_code == 200
    assert generate_response.status_code == 200
    artifact = generate_response.json()["artifact"]
    artifact_dir = Path(artifact["directory"])
    file_names = {Path(item["path"]).name for item in artifact["files"]}
    assert artifact["effective_provider"] == "rd_agent_q"
    assert artifact_dir.parent == workspace.resolve()
    assert {"rdagent.input.json", "rdagent.stdout.log", "rdagent.stderr.log", "rdagent.run.json"} <= file_names
    assert (artifact_dir / "rdagent.stdout.log").read_text().strip() == "generated rdagent-generated.md"
    run_meta = json.loads((artifact_dir / "rdagent.run.json").read_text())
    assert run_meta["status"] == "completed"
    assert run_meta["returncode"] == 0

    get_settings.cache_clear()


def test_strategy_generation_does_not_block_health_route(monkeypatch, tmp_path: Path) -> None:
    configure_strategy_env(monkeypatch, tmp_path)
    original_write_artifact = StrategyFactoryService._write_artifact

    def slow_write_artifact(self, *, analysis, notes):
        time.sleep(1.5)
        return original_write_artifact(self, analysis=analysis, notes=notes)

    monkeypatch.setattr(StrategyFactoryService, "_write_artifact", slow_write_artifact)
    get_settings.cache_clear()

    with TestClient(app) as client:
        analysis_response = client.post(
            "/api/analysis/run",
            json={"symbol": "BTC/USDT", "timeframe": "1m", "notes": "health concurrency"},
        )

        result: dict[str, object] = {}

        def run_generate() -> None:
            result["response"] = client.post(
                "/api/strategy/generate",
                json={"symbol": "BTC/USDT", "timeframe": "1m", "notes": "health concurrency"},
            )

        worker = threading.Thread(target=run_generate)
        worker.start()
        time.sleep(0.2)
        started = time.perf_counter()
        health_response = client.get("/health")
        elapsed = time.perf_counter() - started
        worker.join()

    assert analysis_response.status_code == 200
    assert health_response.status_code == 200
    assert elapsed < 1.0
    assert result["response"].status_code == 200

    get_settings.cache_clear()


def test_strategy_status_exposes_running_generation_state(
    monkeypatch, tmp_path: Path
) -> None:
    configure_strategy_env(monkeypatch, tmp_path)
    original_write_artifact = StrategyFactoryService._write_artifact

    def slow_write_artifact(self, *, analysis, notes):
        time.sleep(1.0)
        return original_write_artifact(self, analysis=analysis, notes=notes)

    monkeypatch.setattr(StrategyFactoryService, "_write_artifact", slow_write_artifact)
    get_settings.cache_clear()

    with TestClient(app) as client:
        analysis_response = client.post(
            "/api/analysis/run",
            json={"symbol": "BTC/USDT", "timeframe": "1m", "notes": "status"},
        )

        result: dict[str, object] = {}

        def run_generate() -> None:
            result["response"] = client.post(
                "/api/strategy/generate",
                json={"symbol": "BTC/USDT", "timeframe": "1m", "notes": "status"},
            )

        worker = threading.Thread(target=run_generate)
        worker.start()
        time.sleep(0.2)
        status_response = client.get("/api/strategy/status")
        worker.join()

    assert analysis_response.status_code == 200
    assert status_response.status_code == 200
    payload = status_response.json()
    assert payload["generation"]["status"] == "running"
    assert payload["generation"]["symbol"] == "BTC/USDT"
    assert payload["generation"]["detail"]
    assert result["response"].status_code == 200

    get_settings.cache_clear()


def test_strategy_timeout_is_reported_in_status(monkeypatch, tmp_path: Path) -> None:
    configure_strategy_env(monkeypatch, tmp_path)
    sleepy_rd_agent = write_sleepy_rd_agent(tmp_path, seconds=0.5)
    monkeypatch.setenv("STRATEGY_FACTORY_PROVIDER", "rd_agent_q")
    monkeypatch.setenv("STRATEGY_FACTORY_RD_AGENT_COMMAND", str(sleepy_rd_agent))
    monkeypatch.setenv("STRATEGY_FACTORY_RD_AGENT_TIMEOUT_SECONDS", "0.1")
    get_settings.cache_clear()

    with TestClient(app) as client:
        analysis_response = client.post(
            "/api/analysis/run",
            json={"symbol": "BTC/USDT", "timeframe": "1m", "notes": "timeout"},
        )
        generate_response = client.post(
            "/api/strategy/generate",
            json={"symbol": "BTC/USDT", "timeframe": "1m", "notes": "timeout"},
        )
        status_response = client.get("/api/strategy/status")

    assert analysis_response.status_code == 200
    assert generate_response.status_code == 409
    payload = status_response.json()
    assert payload["generation"]["status"] == "timeout"
    assert "timed out" in (payload["generation"]["detail"] or "")
    assert payload["generation"]["stderr_path"]

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
