from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app
from app.models.analysis import AgentAnalysisResult, AnalysisRunResult
from app.models.market import Candle, MarketSnapshot
from app.services.analysis import AnalysisService
from app.services.market import MarketRuntimeService


def configure_runtime_env(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("APP_MODE", "mock")
    monkeypatch.setenv("AI_PROVIDER", "mock")
    monkeypatch.setenv("MARKET_DATA_MODE", "mock")
    monkeypatch.setenv("MARKET_SYMBOLS", "BTC/USDT")
    monkeypatch.setenv("MARKET_TIMEFRAMES", "1m")
    monkeypatch.setenv("MARKET_HISTORY_LIMIT", "10")
    monkeypatch.setenv("MARKET_STREAM_ENABLED", "false")
    monkeypatch.setenv("EVENT_LOG_DIR", str(tmp_path / "events"))
    monkeypatch.setenv("EXECUTION_PAPER_STARTING_BALANCE", "10000")
    monkeypatch.setenv("EXECUTION_ORDER_NOTIONAL_USD", "1000")
    monkeypatch.setenv("EXECUTION_ENGINE_START_PAUSED", "false")
    monkeypatch.setenv("EXECUTION_ADAPTER", "freqtrade_mock")
    get_settings.cache_clear()


def make_analysis_result(recommendation: str, price: float) -> AnalysisRunResult:
    now = datetime.now(timezone.utc)
    snapshot = MarketSnapshot(
        symbol="BTC/USDT",
        timeframe="1m",
        exchange_id="binance",
        source="mock",
        generated_at=now,
        last_price=price,
        change_percent=1.0 if recommendation == "buy" else -2.0 if recommendation == "sell" else 0.0,
        volume_24h=12345.0,
        candles=[
            Candle(
                timestamp=now,
                open=price,
                high=price,
                low=price,
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
            signal_bias="bullish" if recommendation == "buy" else "bearish" if recommendation == "sell" else "neutral",
            recommendation=recommendation,
            confidence=0.7,
            summary="data",
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
            signal_bias="bullish" if recommendation == "buy" else "bearish" if recommendation == "sell" else "neutral",
            recommendation=recommendation,
            confidence=0.7,
            summary="ta",
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
            summary="news",
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
        run_id=f"run-{recommendation}-{price}",
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


def build_snapshot_from_closes(closes: list[float]) -> MarketSnapshot:
    now = datetime.now(timezone.utc)
    candles = []
    for index, close in enumerate(closes):
        timestamp = now + timedelta(minutes=index)
        candles.append(
            Candle(
                timestamp=timestamp,
                open=close,
                high=close,
                low=close,
                close=close,
                volume=100.0 + index,
            )
        )

    previous_close = closes[-2] if len(closes) > 1 else closes[-1]
    change_percent = round(((closes[-1] - previous_close) / previous_close) * 100, 2) if previous_close else 0.0
    return MarketSnapshot(
        symbol="BTC/USDT",
        timeframe="1m",
        exchange_id="binance",
        source="mock",
        generated_at=candles[-1].timestamp,
        last_price=closes[-1],
        change_percent=change_percent,
        volume_24h=sum(candle.volume for candle in candles),
        candles=candles,
    )


def test_paper_performance_route_reports_drawdown_stats(monkeypatch, tmp_path: Path) -> None:
    configure_runtime_env(monkeypatch, tmp_path)
    recommendations = iter(
        [
            make_analysis_result("buy", 100.0),
            make_analysis_result("sell", 95.0),
        ]
    )

    async def fake_run_analysis(self, request, *, trigger="manual"):
        return next(recommendations)

    monkeypatch.setattr(AnalysisService, "run_analysis", fake_run_analysis)

    with TestClient(app) as client:
        buy_response = client.post("/api/execution/dispatch", json={"symbol": "BTC/USDT", "timeframe": "1m"})
        sell_response = client.post("/api/execution/dispatch", json={"symbol": "BTC/USDT", "timeframe": "1m"})
        performance_response = client.get("/api/performance/paper")

    assert buy_response.status_code == 200
    assert sell_response.status_code == 200
    assert performance_response.status_code == 200

    payload = performance_response.json()
    assert payload["mode"] == "paper"
    assert payload["trade_count"] == 1
    assert payload["win_rate"] == 0.0
    assert payload["max_drawdown"] > 0.0
    assert payload["total_return"] < 0.0
    assert len(payload["equity_curve"]) >= 3
    assert payload["trades"][0]["pnl"] < 0.0
    assert payload["open_position_count"] == 0
    assert payload["latest_run_id"] == "run-sell-95.0"
    assert payload["latest_trade"]["symbol"] == "BTC/USDT"
    assert payload["latest_trade"]["run_id"] == payload["latest_run_id"]

    get_settings.cache_clear()


def test_backtest_route_replays_offline_history_and_returns_metrics(monkeypatch, tmp_path: Path) -> None:
    configure_runtime_env(monkeypatch, tmp_path)
    snapshot = build_snapshot_from_closes([100.0, 102.0, 103.0, 99.0, 98.0, 101.0, 104.0, 100.0])

    async def fake_ensure_snapshot(self, *, symbol: str, timeframe: str, force_refresh: bool = False):
        assert symbol == "BTC/USDT"
        assert timeframe == "1m"
        return snapshot

    monkeypatch.setattr(MarketRuntimeService, "ensure_snapshot", fake_ensure_snapshot)

    with TestClient(app) as client:
        response = client.post("/api/backtest/run", json={"symbol": "BTC/USDT", "timeframe": "1m"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["mode"] == "backtest"
    assert payload["symbol"] == "BTC/USDT"
    assert payload["timeframe"] == "1m"
    assert payload["trade_count"] >= 1
    assert payload["win_rate"] >= 0.0
    assert payload["max_drawdown"] >= 0.0
    assert payload["equity_curve"]
    assert payload["candle_count"] == len(snapshot.candles)

    get_settings.cache_clear()


def test_backtest_route_falls_back_to_mock_snapshot_when_real_market_is_unavailable(
    monkeypatch, tmp_path: Path
) -> None:
    configure_runtime_env(monkeypatch, tmp_path)
    monkeypatch.setenv("MARKET_DATA_MODE", "real")
    get_settings.cache_clear()

    snapshot = build_snapshot_from_closes([100.0, 102.0, 103.0, 99.0])

    async def fail_ensure_snapshot(self, *, symbol: str, timeframe: str, force_refresh: bool = False):
        raise RuntimeError("binance GET https://api.binance.com/api/v3/exchangeInfo")

    async def fake_build_fallback_snapshot(self, *, symbol: str, timeframe: str):
        assert symbol == "BTC/USDT"
        assert timeframe == "1m"
        return snapshot

    monkeypatch.setattr(MarketRuntimeService, "ensure_snapshot", fail_ensure_snapshot)
    monkeypatch.setattr(MarketRuntimeService, "build_fallback_snapshot", fake_build_fallback_snapshot)

    with TestClient(app) as client:
        response = client.post("/api/backtest/run", json={"symbol": "BTC/USDT", "timeframe": "1m"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["mode"] == "backtest"
    assert payload["symbol"] == "BTC/USDT"
    assert payload["timeframe"] == "1m"
    assert payload["source"] == "mock"
    assert payload["candle_count"] == len(snapshot.candles)

    get_settings.cache_clear()
