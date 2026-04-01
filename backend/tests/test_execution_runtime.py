from datetime import datetime, timezone
from pathlib import Path

from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app
from app.models.analysis import AgentAnalysisResult, AnalysisRunResult
from app.models.market import Candle, MarketSnapshot
from app.services.analysis import AnalysisService


def configure_execution_env(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("APP_MODE", "mock")
    monkeypatch.setenv("AI_PROVIDER", "mock")
    monkeypatch.setenv("MARKET_SYMBOLS", "BTC/USDT")
    monkeypatch.setenv("MARKET_TIMEFRAMES", "1m")
    monkeypatch.setenv("MARKET_HISTORY_LIMIT", "4")
    monkeypatch.setenv("MARKET_STREAM_ENABLED", "false")
    monkeypatch.setenv("EVENT_LOG_DIR", str(tmp_path / "events"))
    monkeypatch.setenv("EXECUTION_PAPER_STARTING_BALANCE", "10000")
    monkeypatch.setenv("EXECUTION_ORDER_NOTIONAL_USD", "500")
    monkeypatch.setenv("EXECUTION_ENGINE_START_PAUSED", "false")
    get_settings.cache_clear()


def _make_analysis_result(recommendation: str) -> AnalysisRunResult:
    now = datetime.now(timezone.utc)
    snapshot = MarketSnapshot(
        symbol="BTC/USDT",
        timeframe="1m",
        exchange_id="binance",
        source="mock",
        generated_at=now,
        last_price=20000.0,
        change_percent=1.2,
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
            confidence=0.7,
            summary="tech ok",
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
            confidence=0.4,
            summary="macro ok",
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
            signal_bias="bullish" if recommendation == "buy" else "bearish" if recommendation == "sell" else "neutral",
            recommendation=recommendation,
            confidence=0.6,
            summary=f"risk says {recommendation}",
            rationale=["r1"],
            evidence=[],
            sources=[],
        ),
    ]
    return AnalysisRunResult(
        run_id=f"run-{recommendation}",
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


def test_execution_dispatch_creates_filled_paper_order(monkeypatch, tmp_path: Path) -> None:
    configure_execution_env(monkeypatch, tmp_path)

    async def fake_run_analysis(self, request, *, trigger="manual"):
        return _make_analysis_result("buy")

    monkeypatch.setattr(AnalysisService, "run_analysis", fake_run_analysis)

    with TestClient(app) as client:
        response = client.post(
            "/api/execution/dispatch",
            json={"symbol": "BTC/USDT", "timeframe": "1m"},
        )
        status_response = client.get("/api/execution/status")
        events_response = client.get("/api/events/recent", params={"limit": 20})

    assert response.status_code == 200
    payload = response.json()
    assert payload["order"]["status"] == "filled"
    assert payload["order"]["side"] == "buy"
    assert payload["status"]["cash_balance"] < 10000
    assert status_response.status_code == 200
    assert status_response.json()["positions"][0]["symbol"] == "BTC/USDT"
    event_types = [event["event_type"] for event in events_response.json()]
    assert "execution.order.created" in event_types
    assert "execution.order.filled" in event_types
    assert "execution.position.updated" in event_types

    get_settings.cache_clear()


def test_execution_pause_blocks_dispatch_until_resumed(monkeypatch, tmp_path: Path) -> None:
    configure_execution_env(monkeypatch, tmp_path)

    async def fake_run_analysis(self, request, *, trigger="manual"):
        return _make_analysis_result("buy")

    monkeypatch.setattr(AnalysisService, "run_analysis", fake_run_analysis)

    with TestClient(app) as client:
        pause_response = client.post(
            "/api/execution/control",
            json={"action": "pause", "reason": "manual stop"},
        )
        blocked_response = client.post(
            "/api/execution/dispatch",
            json={"symbol": "BTC/USDT", "timeframe": "1m"},
        )
        resume_response = client.post(
            "/api/execution/control",
            json={"action": "resume"},
        )

    assert pause_response.status_code == 200
    assert pause_response.json()["engine_status"] == "paused"
    assert blocked_response.status_code == 200
    assert blocked_response.json()["order"] is None
    assert blocked_response.json()["engine_status"] == "paused"
    assert blocked_response.json()["message"] == "manual stop"
    assert resume_response.status_code == 200
    assert resume_response.json()["engine_status"] == "running"

    get_settings.cache_clear()


def test_sell_signal_closes_existing_paper_position(monkeypatch, tmp_path: Path) -> None:
    configure_execution_env(monkeypatch, tmp_path)
    recommendations = iter(["buy", "sell"])

    async def fake_run_analysis(self, request, *, trigger="manual"):
        return _make_analysis_result(next(recommendations))

    monkeypatch.setattr(AnalysisService, "run_analysis", fake_run_analysis)

    with TestClient(app) as client:
        buy_response = client.post(
            "/api/execution/dispatch",
            json={"symbol": "BTC/USDT", "timeframe": "1m"},
        )
        sell_response = client.post(
            "/api/execution/dispatch",
            json={"symbol": "BTC/USDT", "timeframe": "1m"},
        )
        status_response = client.get("/api/execution/status")

    assert buy_response.status_code == 200
    assert sell_response.status_code == 200
    assert sell_response.json()["order"]["side"] == "sell"
    assert status_response.json()["positions"] == []

    get_settings.cache_clear()
