from datetime import datetime, timezone
from pathlib import Path

from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app
from app.models.analysis import AgentAnalysisResult, AnalysisRunResult
from app.models.market import Candle, MarketSnapshot
from app.services.analysis import AnalysisService
from app.services.execution import FreqtradeRestPaperExecutionAdapter


def configure_execution_env(
    monkeypatch,
    tmp_path: Path,
    *,
    adapter: str = "freqtrade_mock",
    base_url: str | None = None,
    username: str | None = None,
    password: str | None = None,
) -> None:
    monkeypatch.setenv("APP_MODE", "mock")
    monkeypatch.setenv("AI_PROVIDER", "mock")
    monkeypatch.setenv("MARKET_DATA_MODE", "mock")
    monkeypatch.setenv("MARKET_SYMBOLS", "BTC/USDT")
    monkeypatch.setenv("MARKET_TIMEFRAMES", "1m")
    monkeypatch.setenv("MARKET_HISTORY_LIMIT", "4")
    monkeypatch.setenv("MARKET_STREAM_ENABLED", "false")
    monkeypatch.setenv("EVENT_LOG_DIR", str(tmp_path / "events"))
    monkeypatch.setenv("EXECUTION_PAPER_STARTING_BALANCE", "10000")
    monkeypatch.setenv("EXECUTION_ORDER_NOTIONAL_USD", "500")
    monkeypatch.setenv("EXECUTION_ENGINE_START_PAUSED", "false")
    monkeypatch.setenv("EXECUTION_ADAPTER", adapter)
    if base_url is None:
        monkeypatch.delenv("EXECUTION_FREQTRADE_REST_BASE_URL", raising=False)
    else:
        monkeypatch.setenv("EXECUTION_FREQTRADE_REST_BASE_URL", base_url)
    if username is None:
        monkeypatch.delenv("EXECUTION_FREQTRADE_REST_USERNAME", raising=False)
    else:
        monkeypatch.setenv("EXECUTION_FREQTRADE_REST_USERNAME", username)
    if password is None:
        monkeypatch.delenv("EXECUTION_FREQTRADE_REST_PASSWORD", raising=False)
    else:
        monkeypatch.setenv("EXECUTION_FREQTRADE_REST_PASSWORD", password)
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
    assert payload["status"]["adapter_runtime"]["status"] == "mock"
    assert payload["status"]["cash_balance"] < 10000
    assert status_response.status_code == 200
    assert status_response.json()["adapter_runtime"]["status"] == "mock"
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


def test_freqtrade_rest_paper_adapter_reports_connected_and_fills_order(
    monkeypatch, tmp_path: Path
) -> None:
    configure_execution_env(
        monkeypatch,
        tmp_path,
        adapter="freqtrade_rest_paper",
        base_url="http://freqtrade.local",
        username="frequser",
        password="freqpass",
    )

    async def fake_run_analysis(self, request, *, trigger="manual"):
        return _make_analysis_result("buy")

    async def fake_request_json(self, method: str, path: str, payload=None, *, auth: bool = True):
        if path == "/api/v1/ping":
            return {"status": "pong"}
        if path == "/api/v1/show_config":
            return {"dry_run": True}
        if path == "/api/v1/forceenter":
            return {"trade_id": 17, "pair": payload["pair"], "is_open": True}
        if path == "/api/v1/trade/17":
            return {
                "trade_id": 17,
                "pair": "BTC/USDT",
                "is_open": True,
                "open_rate": 20010.0,
                "amount": 0.02499,
                "stake_amount": 500.0,
                "fee_open_cost": 0.5,
            }
        raise AssertionError(f"Unexpected Freqtrade REST call: {method} {path}")

    monkeypatch.setattr(AnalysisService, "run_analysis", fake_run_analysis)
    monkeypatch.setattr(
        FreqtradeRestPaperExecutionAdapter,
        "_request_json",
        fake_request_json,
    )

    with TestClient(app) as client:
        status_response = client.get("/api/execution/status")
        dispatch_response = client.post(
            "/api/execution/dispatch",
            json={"symbol": "BTC/USDT", "timeframe": "1m"},
        )

    assert status_response.status_code == 200
    assert status_response.json()["adapter"] == "freqtrade_rest_paper"
    assert status_response.json()["adapter_runtime"]["status"] == "connected"
    assert "dry-run" in status_response.json()["adapter_runtime"]["detail"].lower()

    assert dispatch_response.status_code == 200
    payload = dispatch_response.json()
    assert payload["order"]["status"] == "filled"
    assert payload["order"]["adapter"] == "freqtrade_rest_paper"
    assert payload["order"]["adapter_trade_id"] == "17"
    assert payload["status"]["adapter_runtime"]["status"] == "connected"

    get_settings.cache_clear()


def test_freqtrade_rest_paper_adapter_failure_is_honest_and_does_not_fill(
    monkeypatch, tmp_path: Path
) -> None:
    configure_execution_env(
        monkeypatch,
        tmp_path,
        adapter="freqtrade_rest_paper",
        base_url="http://freqtrade.local",
        username="frequser",
        password="freqpass",
    )

    async def fake_run_analysis(self, request, *, trigger="manual"):
        return _make_analysis_result("buy")

    async def fake_request_json(self, method: str, path: str, payload=None, *, auth: bool = True):
        if path == "/api/v1/ping":
            raise RuntimeError("freqtrade rest offline")
        raise AssertionError(f"Unexpected Freqtrade REST call: {method} {path}")

    monkeypatch.setattr(AnalysisService, "run_analysis", fake_run_analysis)
    monkeypatch.setattr(
        FreqtradeRestPaperExecutionAdapter,
        "_request_json",
        fake_request_json,
    )

    with TestClient(app) as client:
        status_response = client.get("/api/execution/status")
        dispatch_response = client.post(
            "/api/execution/dispatch",
            json={"symbol": "BTC/USDT", "timeframe": "1m"},
        )

    assert status_response.status_code == 200
    status_payload = status_response.json()
    assert status_payload["adapter"] == "freqtrade_rest_paper"
    assert status_payload["adapter_runtime"]["status"] == "offline"
    assert "offline" in status_payload["adapter_runtime"]["detail"].lower()
    assert "freqtrade rest offline" in status_payload["adapter_runtime"]["last_error"].lower()

    assert dispatch_response.status_code == 200
    payload = dispatch_response.json()
    assert payload["order"]["status"] == "blocked"
    assert "not connected" in payload["message"].lower() or "offline" in payload["message"].lower()
    assert payload["status"]["cash_balance"] == 10000
    assert payload["status"]["positions"] == []
    assert payload["status"]["adapter_runtime"]["status"] == "offline"

    get_settings.cache_clear()


def test_freqtrade_rest_paper_submit_failure_after_health_check_returns_blocked(
    monkeypatch, tmp_path: Path
) -> None:
    configure_execution_env(
        monkeypatch,
        tmp_path,
        adapter="freqtrade_rest_paper",
        base_url="http://freqtrade.local",
        username="frequser",
        password="freqpass",
    )

    async def fake_run_analysis(self, request, *, trigger="manual"):
        return _make_analysis_result("buy")

    async def fake_request_json(self, method: str, path: str, payload=None, *, auth: bool = True):
        if path == "/api/v1/ping":
            return {"status": "pong"}
        if path == "/api/v1/show_config":
            return {"dry_run": True}
        if path == "/api/v1/forceenter":
            raise RuntimeError("freqtrade order rejected")
        raise AssertionError(f"Unexpected Freqtrade REST call: {method} {path}")

    monkeypatch.setattr(AnalysisService, "run_analysis", fake_run_analysis)
    monkeypatch.setattr(
        FreqtradeRestPaperExecutionAdapter,
        "_request_json",
        fake_request_json,
    )

    with TestClient(app) as client:
        status_before = client.get("/api/execution/status")
        dispatch_response = client.post(
            "/api/execution/dispatch",
            json={"symbol": "BTC/USDT", "timeframe": "1m"},
        )
        status_after = client.get("/api/execution/status")

    assert status_before.status_code == 200
    assert status_before.json()["adapter_runtime"]["status"] == "connected"

    assert dispatch_response.status_code == 200
    payload = dispatch_response.json()
    assert payload["order"]["status"] == "blocked"
    assert "freqtrade order rejected" in payload["message"].lower()
    assert payload["status"]["adapter_runtime"]["status"] == "degraded"
    assert payload["status"]["cash_balance"] == 10000
    assert payload["status"]["positions"] == []

    assert status_after.status_code == 200
    assert status_after.json()["adapter_runtime"]["status"] == "degraded"
    assert "freqtrade order rejected" in status_after.json()["adapter_runtime"]["last_error"].lower()

    get_settings.cache_clear()


def test_freqtrade_rest_paper_sell_uses_tracked_trade_id_and_confirms_exit(
    monkeypatch, tmp_path: Path
) -> None:
    configure_execution_env(
        monkeypatch,
        tmp_path,
        adapter="freqtrade_rest_paper",
        base_url="http://freqtrade.local",
        username="frequser",
        password="freqpass",
    )
    recommendations = iter(["buy", "sell"])

    async def fake_run_analysis(self, request, *, trigger="manual"):
        return _make_analysis_result(next(recommendations))

    async def fake_request_json(self, method: str, path: str, payload=None, *, auth: bool = True):
        if path == "/api/v1/ping":
            return {"status": "pong"}
        if path == "/api/v1/show_config":
            return {"dry_run": True}
        if path == "/api/v1/forceenter":
            return {"trade_id": 17, "pair": payload["pair"], "is_open": True}
        if path == "/api/v1/trade/17" and method == "GET":
            if sell_state["value"]:
                return {
                    "trade_id": 17,
                    "pair": "BTC/USDT",
                    "is_open": False,
                    "close_rate": 19950.0,
                    "amount": 0.02499,
                    "fee_close_cost": 0.45,
                }
            return {
                "trade_id": 17,
                "pair": "BTC/USDT",
                "is_open": True,
                "open_rate": 20010.0,
                "amount": 0.02499,
                "stake_amount": 500.0,
                "fee_open_cost": 0.5,
            }
        if path == "/api/v1/forceexit":
            sell_state["value"] = True
            assert payload["tradeid"] == 17
            return {"trade_id": 17}
        raise AssertionError(f"Unexpected Freqtrade REST call: {method} {path}")

    sell_state = {"value": False}
    monkeypatch.setattr(AnalysisService, "run_analysis", fake_run_analysis)
    monkeypatch.setattr(
        FreqtradeRestPaperExecutionAdapter,
        "_request_json",
        fake_request_json,
    )

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
    assert buy_response.json()["order"]["adapter_trade_id"] == "17"

    assert sell_response.status_code == 200
    assert sell_response.json()["order"]["side"] == "sell"
    assert sell_response.json()["order"]["status"] == "filled"
    assert sell_response.json()["order"]["adapter_trade_id"] == "17"
    assert status_response.json()["positions"] == []

    get_settings.cache_clear()


def test_freqtrade_rest_paper_blocks_add_on_buy_until_multi_trade_reconciliation_exists(
    monkeypatch, tmp_path: Path
) -> None:
    configure_execution_env(
        monkeypatch,
        tmp_path,
        adapter="freqtrade_rest_paper",
        base_url="http://freqtrade.local",
        username="frequser",
        password="freqpass",
    )
    forceenter_calls = {"count": 0}

    async def fake_run_analysis(self, request, *, trigger="manual"):
        return _make_analysis_result("buy")

    async def fake_request_json(self, method: str, path: str, payload=None, *, auth: bool = True):
        if path == "/api/v1/ping":
            return {"status": "pong"}
        if path == "/api/v1/show_config":
            return {"dry_run": True}
        if path == "/api/v1/forceenter":
            forceenter_calls["count"] += 1
            return {"trade_id": 17, "pair": payload["pair"], "is_open": True}
        if path == "/api/v1/trade/17":
            return {
                "trade_id": 17,
                "pair": "BTC/USDT",
                "is_open": True,
                "open_rate": 20010.0,
                "amount": 0.02499,
                "stake_amount": 500.0,
                "fee_open_cost": 0.5,
            }
        raise AssertionError(f"Unexpected Freqtrade REST call: {method} {path}")

    monkeypatch.setattr(AnalysisService, "run_analysis", fake_run_analysis)
    monkeypatch.setattr(
        FreqtradeRestPaperExecutionAdapter,
        "_request_json",
        fake_request_json,
    )

    with TestClient(app) as client:
        first_buy = client.post(
            "/api/execution/dispatch",
            json={"symbol": "BTC/USDT", "timeframe": "1m"},
        )
        second_buy = client.post(
            "/api/execution/dispatch",
            json={"symbol": "BTC/USDT", "timeframe": "1m"},
        )

    assert first_buy.status_code == 200
    assert first_buy.json()["order"]["status"] == "filled"
    assert second_buy.status_code == 200
    assert second_buy.json()["order"] is None
    assert "one open trade per symbol" in second_buy.json()["message"].lower()
    assert forceenter_calls["count"] == 1

    get_settings.cache_clear()


def test_workflow_performance_stage_tracks_latest_trade(monkeypatch, tmp_path: Path) -> None:
    configure_execution_env(monkeypatch, tmp_path)
    recommendations = iter(["buy", "sell"])

    async def fake_run_analysis(self, request, *, trigger="manual"):
        return _make_analysis_result(next(recommendations))

    monkeypatch.setattr(AnalysisService, "run_analysis", fake_run_analysis)

    with TestClient(app) as client:
        client.post(
            "/api/execution/dispatch",
            json={"symbol": "BTC/USDT", "timeframe": "1m"},
        )
        client.post(
            "/api/execution/dispatch",
            json={"symbol": "BTC/USDT", "timeframe": "1m"},
        )
        snapshot_response = client.get("/api/workflow/snapshot", params={"symbol": "BTC/USDT", "timeframe": "1m"})

    assert snapshot_response.status_code == 200
    performance_stage = snapshot_response.json()["stages"]["performance"]
    facts_by_label = {fact["label"]: fact for fact in performance_stage["facts"]}
    assert performance_stage["run_id"] == "run-sell"
    assert facts_by_label["Open Positions"]["value"] == "0"

    get_settings.cache_clear()
