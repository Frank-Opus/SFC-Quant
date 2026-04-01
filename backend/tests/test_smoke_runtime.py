import logging
from datetime import datetime, timezone

from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.core.logging import StructuredJsonFormatter
from app.main import app
from app.models.analysis import AgentAnalysisResult, AnalysisRunResult
from app.models.market import Candle, MarketSnapshot
from app.services.analysis import AnalysisService


def configure_smoke_env(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("APP_MODE", "mock")
    monkeypatch.setenv("AI_PROVIDER", "mock")
    monkeypatch.setenv("MARKET_SYMBOLS", "BTC/USDT")
    monkeypatch.setenv("MARKET_TIMEFRAMES", "1m")
    monkeypatch.setenv("MARKET_HISTORY_LIMIT", "4")
    monkeypatch.setenv("MARKET_STREAM_ENABLED", "false")
    monkeypatch.setenv("EVENT_LOG_DIR", str(tmp_path / "events"))
    monkeypatch.setenv("STRATEGY_FACTORY_ENABLED", "true")
    monkeypatch.setenv("STRATEGY_FACTORY_WORKSPACE", str(tmp_path / "strategy_factory"))
    get_settings.cache_clear()


def _make_buy_analysis() -> AnalysisRunResult:
    now = datetime.now(timezone.utc)
    snapshot = MarketSnapshot(
        symbol="BTC/USDT",
        timeframe="1m",
        exchange_id="binance",
        source="mock",
        generated_at=now,
        last_price=20000.0,
        change_percent=1.5,
        volume_24h=12345.0,
        candles=[
            Candle(
                timestamp=now,
                open=19900.0,
                high=20100.0,
                low=19850.0,
                close=20000.0,
                volume=100.0,
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
            summary="data ok",
            rationale=["r1"],
            evidence=[],
            sources=[],
            macro_thesis=None,
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
            summary="tech ok",
            rationale=["r1"],
            evidence=[],
            sources=[],
            macro_thesis=None,
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
            confidence=0.5,
            summary="macro ok",
            rationale=["r1"],
            evidence=[],
            sources=[],
            macro_thesis=None,
        ),
        AgentAnalysisResult(
            role="risk_decision",
            status="completed",
            provider="mock",
            model="mock-primoagent-v1",
            generated_at=now,
            latency_ms=1,
            signal_bias="bullish",
            recommendation="buy",
            confidence=0.7,
            summary="risk says buy",
            rationale=["r1"],
            evidence=[],
            sources=[],
            macro_thesis=None,
        ),
    ]
    return AnalysisRunResult(
        run_id="smoke-buy-run",
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
        overall_recommendation="buy",
    )


def test_smoke_rest_diagnostics_and_paper_trade_path(monkeypatch, tmp_path) -> None:
    configure_smoke_env(monkeypatch, tmp_path)

    async def fake_run_analysis(self, request, *, trigger="manual"):
        return _make_buy_analysis()

    monkeypatch.setattr(AnalysisService, "run_analysis", fake_run_analysis)

    with TestClient(app) as client:
        health_response = client.get("/health/ready")
        market_response = client.get("/api/market/snapshot")
        diagnostics_response = client.get("/api/diagnostics/summary")
        dispatch_response = client.post(
            "/api/execution/dispatch",
            json={"symbol": "BTC/USDT", "timeframe": "1m", "notes": "smoke"},
        )

    assert health_response.status_code == 200
    assert health_response.json()["service"] == "backend"
    assert market_response.status_code == 200
    assert market_response.json()["snapshots"]
    assert diagnostics_response.status_code == 200
    diagnostics = diagnostics_response.json()
    assert diagnostics["runtime"]["name"] == "dSFC-Quant"
    assert diagnostics["strategy"]["enabled"] is True
    assert dispatch_response.status_code == 200
    assert dispatch_response.json()["order"]["status"] == "filled"
    assert dispatch_response.json()["status"]["recent_orders"]

    get_settings.cache_clear()


def test_smoke_websocket_streams_connection_and_snapshot(monkeypatch, tmp_path) -> None:
    configure_smoke_env(monkeypatch, tmp_path)

    with TestClient(app) as client:
        with client.websocket_connect("/ws") as websocket:
            connected = websocket.receive_json()
            snapshot = websocket.receive_json()

    assert connected["event_type"] == "system.connected"
    assert snapshot["event_type"] == "market.snapshot"
    assert snapshot["payload"]["snapshots"]
    assert snapshot["payload"]["runtime"]["name"] == "dSFC-Quant"

    get_settings.cache_clear()


def test_structured_json_formatter_emits_machine_readable_logs() -> None:
    formatter = StructuredJsonFormatter(app_name="dSFC-Quant", app_env="test")
    record = logging.LogRecord(
        name="test.logger",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="event_published",
        args=(),
        exc_info=None,
    )
    record.context = {"event_type": "market.snapshot", "source": "tests"}

    payload = formatter.format(record)

    assert '"message": "event_published"' in payload
    assert '"event_type": "market.snapshot"' in payload
    assert '"source": "tests"' in payload
