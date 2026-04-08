from datetime import datetime, timezone
from pathlib import Path

from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app
from app.models.analysis import AgentAnalysisResult, AnalysisRunResult
from app.models.market import Candle, MarketSnapshot
from app.services.analysis import AnalysisService


def configure_workflow_env(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("APP_MODE", "mock")
    monkeypatch.setenv("AI_PROVIDER", "mock")
    monkeypatch.setenv("MARKET_DATA_MODE", "mock")
    monkeypatch.setenv("MARKET_SYMBOLS", "BTC/USDT")
    monkeypatch.setenv("MARKET_TIMEFRAMES", "1m")
    monkeypatch.setenv("MARKET_HISTORY_LIMIT", "6")
    monkeypatch.setenv("MARKET_STREAM_ENABLED", "false")
    monkeypatch.setenv("EVENT_LOG_DIR", str(tmp_path / "events"))
    monkeypatch.setenv("EXECUTION_ADAPTER", "freqtrade_mock")
    monkeypatch.setenv("EXECUTION_ENGINE_START_PAUSED", "false")
    monkeypatch.setenv("STRATEGY_FACTORY_ENABLED", "true")
    monkeypatch.setenv("STRATEGY_FACTORY_PROVIDER", "mock_rdq")
    monkeypatch.setenv("STRATEGY_FACTORY_WORKSPACE", str(tmp_path / "strategy_factory"))
    monkeypatch.setenv("STRATEGY_FACTORY_RD_AGENT_COMMAND", str(tmp_path / "missing-rdagent"))
    monkeypatch.setenv(
        "STRATEGY_FACTORY_TRADINGAGENTS_COMMAND",
        str(tmp_path / "missing-tradingagents"),
    )
    get_settings.cache_clear()


def write_fake_tradingagents(tmp_path: Path) -> Path:
    script_path = tmp_path / "fake_tradingagents.py"
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
                "generated_path = artifact_dir / 'tradingagents-generated.md'",
                "generated_path.write_text(",
                "    f\"# TradingAgents Output\\n\\n{payload['symbol']} {payload['timeframe']}\\n\"",
                ")",
                "print(f\"generated {generated_path.name}\")",
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    script_path.chmod(0o755)
    return script_path


def make_analysis_result(run_id: str, recommendation: str = "buy") -> AnalysisRunResult:
    now = datetime.now(timezone.utc)
    snapshot = MarketSnapshot(
        symbol="BTC/USDT",
        timeframe="1m",
        exchange_id="binance",
        source="mock",
        generated_at=now,
        last_price=100.0,
        change_percent=1.25,
        volume_24h=5000.0,
        candles=[
            Candle(
                timestamp=now,
                open=99.0,
                high=101.0,
                low=98.5,
                close=100.0,
                volume=12.0,
            )
        ],
    )
    outputs = [
        AgentAnalysisResult(
            role="data",
            status="completed",
            provider="mock",
            model="mock-primoagent-v1",
            generated_at=now,
            latency_ms=1,
            signal_bias="bullish",
            recommendation="buy",
            confidence=0.7,
            summary="Market regime is constructive.",
            rationale=["r1"],
            evidence=[],
            sources=[],
        ),
        AgentAnalysisResult(
            role="technical_analysis",
            status="completed",
            provider="mock",
            model="mock-primoagent-v1",
            generated_at=now,
            latency_ms=1,
            signal_bias="bullish",
            recommendation="buy",
            confidence=0.72,
            summary="Momentum is positive.",
            rationale=["r1"],
            evidence=[],
            sources=[],
        ),
        AgentAnalysisResult(
            role="news_geopolitics",
            status="completed",
            provider="mock",
            model="mock-primoagent-v1",
            generated_at=now,
            latency_ms=1,
            signal_bias="neutral",
            recommendation="hold",
            confidence=0.45,
            summary="Macro is neutral.",
            rationale=["r1"],
            evidence=[],
            sources=[],
        ),
        AgentAnalysisResult(
            role="risk_decision",
            status="completed",
            provider="mock",
            model="mock-primoagent-v1",
            generated_at=now,
            latency_ms=1,
            signal_bias="bullish",
            recommendation=recommendation,
            confidence=0.68,
            summary="Risk allows a paper buy.",
            rationale=["r1"],
            evidence=[],
            sources=[],
        ),
    ]
    return AnalysisRunResult(
        run_id=run_id,
        symbol="BTC/USDT",
        timeframe="1m",
        trigger="manual",
        status="completed",
        provider="mock",
        model="mock-primoagent-v1",
        started_at=now,
        completed_at=now,
        market_snapshot=snapshot,
        outputs=outputs,
        overall_recommendation=recommendation,
    )


def test_workflow_snapshot_route_returns_stage_truth(monkeypatch, tmp_path: Path) -> None:
    configure_workflow_env(monkeypatch, tmp_path)

    with TestClient(app) as client:
        response = client.get("/api/workflow/snapshot")

    assert response.status_code == 200
    payload = response.json()
    assert payload["symbol"] == "BTC/USDT"
    assert payload["timeframe"] == "1m"
    assert payload["execution_mode"] == "paper"
    assert payload["execution_adapter"] == "freqtrade_mock"
    assert set(payload["stages"].keys()) == {
        "market",
        "analysis",
        "strategy",
        "risk",
        "execution",
        "performance",
    }
    assert payload["stages"]["market"]["status"] in {"ready", "completed"}
    assert payload["stages"]["analysis"]["status"] == "idle"
    assert payload["roles"] == []
    assert payload["providers"]

    get_settings.cache_clear()


def test_workflow_snapshot_correlates_run_id_across_analysis_strategy_and_execution(
    monkeypatch,
    tmp_path: Path,
) -> None:
    configure_workflow_env(monkeypatch, tmp_path)
    run_id = "run-workflow-001"

    async def fake_run_analysis(self, request, *, trigger="manual"):
        result = make_analysis_result(run_id=run_id, recommendation="buy")
        self._latest_runs[f"{request.symbol}:{request.timeframe}"] = result
        return result

    monkeypatch.setattr(AnalysisService, "run_analysis", fake_run_analysis)

    with TestClient(app) as client:
        analysis_response = client.post(
            "/api/analysis/run",
            json={"symbol": "BTC/USDT", "timeframe": "1m"},
        )
        strategy_response = client.post(
            "/api/strategy/generate",
            json={"symbol": "BTC/USDT", "timeframe": "1m", "notes": "workflow"},
        )
        dispatch_response = client.post(
            "/api/execution/dispatch",
            json={"symbol": "BTC/USDT", "timeframe": "1m"},
        )
        workflow_response = client.get(
            "/api/workflow/snapshot",
            params={"symbol": "BTC/USDT", "timeframe": "1m"},
        )

    assert analysis_response.status_code == 200
    assert strategy_response.status_code == 200
    assert dispatch_response.status_code == 200
    assert workflow_response.status_code == 200

    payload = workflow_response.json()
    assert payload["current_run_id"] == run_id
    assert payload["stages"]["analysis"]["run_id"] == run_id
    assert payload["stages"]["strategy"]["run_id"] == run_id
    assert payload["stages"]["execution"]["run_id"] == run_id
    assert payload["stages"]["performance"]["run_id"] == run_id


def test_workflow_current_handoff_uses_run_ledger_detail(
    monkeypatch,
    tmp_path: Path,
) -> None:
    configure_workflow_env(monkeypatch, tmp_path)
    run_id = "run-workflow-002"

    async def fake_run_analysis(self, request, *, trigger="manual"):
        result = make_analysis_result(run_id=run_id, recommendation="buy")
        self._latest_runs[f"{request.symbol}:{request.timeframe}"] = result
        return result

    monkeypatch.setattr(AnalysisService, "run_analysis", fake_run_analysis)

    with TestClient(app) as client:
        client.post(
            "/api/analysis/run",
            json={"symbol": "BTC/USDT", "timeframe": "1m"},
        )
        client.post(
            "/api/strategy/generate",
            json={"symbol": "BTC/USDT", "timeframe": "1m", "notes": "workflow"},
        )
        client.post(
            "/api/execution/dispatch",
            json={"symbol": "BTC/USDT", "timeframe": "1m"},
        )
        workflow_response = client.get(
            "/api/workflow/snapshot",
            params={"symbol": "BTC/USDT", "timeframe": "1m"},
        )
        payload = workflow_response.json()
        active_stage_key = payload["active_stage_key"]
        ledger_record = client.app.state.run_ledger.latest_stage_record(run_id, active_stage_key)

    assert active_stage_key is not None
    assert ledger_record is not None
    assert payload["current_handoff"] == ledger_record.detail
    assert payload["roles"][0]["run_id"] == run_id
    assert payload["active_stage_key"] in {"execution", "performance", "strategy"}

    get_settings.cache_clear()


def test_workflow_snapshot_tracks_provider_artifacts_per_provider(
    monkeypatch,
    tmp_path: Path,
) -> None:
    configure_workflow_env(monkeypatch, tmp_path)
    fake_tradingagents = write_fake_tradingagents(tmp_path)
    monkeypatch.setenv("STRATEGY_FACTORY_TRADINGAGENTS_COMMAND", str(fake_tradingagents))
    get_settings.cache_clear()

    with TestClient(app) as client:
        analysis_response = client.post(
            "/api/analysis/run",
            json={"symbol": "BTC/USDT", "timeframe": "1m"},
        )
        mock_strategy_response = client.post(
            "/api/strategy/generate",
            json={"symbol": "BTC/USDT", "timeframe": "1m", "notes": "mock"},
        )
        config_response = client.post(
            "/api/strategy/config",
            json={"provider": "tradingagents_cn"},
        )
        tradingagents_strategy_response = client.post(
            "/api/strategy/generate",
            json={"symbol": "BTC/USDT", "timeframe": "1m", "notes": "tradingagents"},
        )
        workflow_response = client.get(
            "/api/workflow/snapshot",
            params={"symbol": "BTC/USDT", "timeframe": "1m"},
        )

    assert analysis_response.status_code == 200
    assert mock_strategy_response.status_code == 200
    assert config_response.status_code == 200
    assert tradingagents_strategy_response.status_code == 200
    assert workflow_response.status_code == 200

    providers = {
        item["provider"]: item
        for item in workflow_response.json()["providers"]
    }
    assert providers["mock_rdq"]["artifact_count"] == 3
    assert providers["tradingagents_cn"]["artifact_count"] >= 7

    get_settings.cache_clear()
