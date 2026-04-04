from datetime import datetime, timezone
from pathlib import Path

from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app
from app.models.analysis import AgentAnalysisResult, AnalysisRunResult
from app.models.market import Candle, MarketSnapshot
from app.services.analysis import AnalysisService
from app.services.risk import LIVE_MODE_CONFIRMATION


def configure_risk_env(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("APP_MODE", "mock")
    monkeypatch.setenv("AI_PROVIDER", "mock")
    monkeypatch.setenv("MARKET_DATA_MODE", "mock")
    monkeypatch.setenv("MARKET_SYMBOLS", "BTC/USDT")
    monkeypatch.setenv("MARKET_TIMEFRAMES", "1m")
    monkeypatch.setenv("MARKET_HISTORY_LIMIT", "4")
    monkeypatch.setenv("MARKET_STREAM_ENABLED", "false")
    monkeypatch.setenv("EVENT_LOG_DIR", str(tmp_path / "events"))
    monkeypatch.setenv("EXECUTION_ADAPTER", "freqtrade_mock")
    monkeypatch.setenv("EXECUTION_PAPER_STARTING_BALANCE", "10000")
    monkeypatch.setenv("EXECUTION_ORDER_NOTIONAL_USD", "500")
    monkeypatch.setenv("RISK_MAX_POSITION_NOTIONAL_USD", "1000")
    monkeypatch.setenv("RISK_MAX_CONCURRENT_TRADES", "3")
    monkeypatch.setenv("RISK_DAILY_LOSS_LIMIT_USD", "250")
    monkeypatch.setenv("RISK_REQUIRE_AGENT_APPROVAL", "true")
    monkeypatch.setenv("RISK_MIN_APPROVAL_CONFIDENCE", "0.55")
    get_settings.cache_clear()


def _make_analysis_result(
    recommendation: str,
    *,
    price: float = 20000.0,
    risk_status: str = "completed",
    risk_confidence: float = 0.7,
) -> AnalysisRunResult:
    now = datetime.now(timezone.utc)
    snapshot = MarketSnapshot(
        symbol="BTC/USDT",
        timeframe="1m",
        exchange_id="binance",
        source="mock",
        generated_at=now,
        last_price=price,
        change_percent=1.2,
        volume_24h=12345.0,
        candles=[
            Candle(
                timestamp=now,
                open=price - 100,
                high=price + 100,
                low=price - 150,
                close=price,
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
            status=risk_status,
            provider="mock",
            model="mock-primoagent-v1",
            generated_at=now,
            latency_ms=1,
            signal_bias="bullish" if recommendation == "buy" else "bearish" if recommendation == "sell" else "neutral",
            recommendation=recommendation,
            confidence=risk_confidence,
            summary=f"risk says {recommendation}",
            rationale=["r1"],
            evidence=[],
            sources=[],
        ),
    ]
    return AnalysisRunResult(
        run_id=f"run-{recommendation}-{int(price)}-{risk_status}",
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


def test_blocked_symbol_policy_denies_dispatch_and_halts(monkeypatch, tmp_path: Path) -> None:
    configure_risk_env(monkeypatch, tmp_path)

    async def fake_run_analysis(self, request, *, trigger="manual"):
        return _make_analysis_result("buy")

    monkeypatch.setattr(AnalysisService, "run_analysis", fake_run_analysis)

    with TestClient(app) as client:
        policy_response = client.post(
            "/api/risk/policy",
            json={"blocked_symbols": ["BTC/USDT"]},
        )
        dispatch_response = client.post(
            "/api/execution/dispatch",
            json={"symbol": "BTC/USDT", "timeframe": "1m"},
        )
        risk_status = client.get("/api/risk/status")
        events_response = client.get("/api/events/recent", params={"limit": 20})

    assert policy_response.status_code == 200
    assert dispatch_response.status_code == 200
    assert dispatch_response.json()["order"] is None
    assert dispatch_response.json()["engine_status"] == "paused"
    assert risk_status.json()["halted"] is True
    assert "blocked" in risk_status.json()["halt_reason"]
    event_types = [event["event_type"] for event in events_response.json()]
    assert "risk.approval.denied" in event_types
    assert "risk.halt.triggered" in event_types

    get_settings.cache_clear()


def test_risk_approval_guard_blocks_fallback_without_halt(monkeypatch, tmp_path: Path) -> None:
    configure_risk_env(monkeypatch, tmp_path)

    async def fake_run_analysis(self, request, *, trigger="manual"):
        return _make_analysis_result("buy", risk_status="fallback", risk_confidence=0.2)

    monkeypatch.setattr(AnalysisService, "run_analysis", fake_run_analysis)

    with TestClient(app) as client:
        dispatch_response = client.post(
            "/api/execution/dispatch",
            json={"symbol": "BTC/USDT", "timeframe": "1m"},
        )
        risk_status = client.get("/api/risk/status")

    assert dispatch_response.status_code == 200
    assert dispatch_response.json()["order"] is None
    assert dispatch_response.json()["engine_status"] == "running"
    assert risk_status.json()["halted"] is False

    get_settings.cache_clear()


def test_daily_loss_limit_auto_halts_after_realized_loss(monkeypatch, tmp_path: Path) -> None:
    configure_risk_env(monkeypatch, tmp_path)
    monkeypatch.setenv("RISK_DAILY_LOSS_LIMIT_USD", "10")
    get_settings.cache_clear()
    sequence = iter([
        _make_analysis_result("buy", price=20000.0),
        _make_analysis_result("sell", price=19000.0),
    ])

    async def fake_run_analysis(self, request, *, trigger="manual"):
        return next(sequence)

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
        risk_status = client.get("/api/risk/status")
        execution_status = client.get("/api/execution/status")

    assert buy_response.status_code == 200
    assert sell_response.status_code == 200
    assert risk_status.json()["halted"] is True
    assert risk_status.json()["daily_realized_pnl"] < 0
    assert execution_status.json()["engine_status"] == "paused"

    get_settings.cache_clear()


def test_live_mode_requires_confirmation_and_credentials(monkeypatch, tmp_path: Path) -> None:
    configure_risk_env(monkeypatch, tmp_path)
    monkeypatch.setenv("APP_MODE", "paper")
    monkeypatch.setenv("EXCHANGE_API_KEY", "demo-key")
    monkeypatch.setenv("EXCHANGE_API_SECRET", "demo-secret")
    get_settings.cache_clear()

    with TestClient(app) as client:
        denied = client.post(
            "/api/risk/live-mode",
            json={"enable": True, "confirmation_text": "wrong"},
        )
        enabled = client.post(
            "/api/risk/live-mode",
            json={"enable": True, "confirmation_text": LIVE_MODE_CONFIRMATION},
        )
        disabled = client.post(
            "/api/risk/live-mode",
            json={"enable": False},
        )

    assert denied.status_code == 200
    assert denied.json()["live_mode_enabled"] is False
    assert "Confirmation text mismatch" in denied.json()["live_mode_reason"]
    assert enabled.status_code == 200
    assert enabled.json()["live_mode_enabled"] is True
    assert disabled.status_code == 200
    assert disabled.json()["live_mode_enabled"] is False

    get_settings.cache_clear()
