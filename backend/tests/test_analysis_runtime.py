from pathlib import Path

from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app
from app.services.providers import (
    OpenAICompatibleProvider,
    ProviderFactory,
    _candidate_urls,
    _extract_json_object,
    _extract_response_text,
    _normalize_provider_payload,
)


def configure_analysis_env(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("APP_MODE", "mock")
    monkeypatch.setenv("MARKET_SYMBOLS", "BTC/USDT")
    monkeypatch.setenv("MARKET_TIMEFRAMES", "1m")
    monkeypatch.setenv("MARKET_HISTORY_LIMIT", "4")
    monkeypatch.setenv("MARKET_STREAM_ENABLED", "false")
    monkeypatch.setenv("EVENT_LOG_DIR", str(tmp_path / "events"))
    get_settings.cache_clear()


def test_manual_analysis_run_returns_all_primoagent_roles(monkeypatch, tmp_path: Path) -> None:
    configure_analysis_env(monkeypatch, tmp_path)
    monkeypatch.setenv("AI_PROVIDER", "mock")
    monkeypatch.delenv("AI_API_KEY", raising=False)
    monkeypatch.delenv("AI_BASE_URL", raising=False)
    monkeypatch.delenv("AI_MODEL", raising=False)
    get_settings.cache_clear()

    with TestClient(app) as client:
        response = client.post(
            "/api/analysis/run",
            json={"symbol": "BTC/USDT", "timeframe": "1m", "notes": "phase-3 smoke"},
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["symbol"] == "BTC/USDT"
    assert payload["status"] == "completed"
    assert payload["overall_recommendation"] in {"buy", "sell", "hold", "wait"}
    assert [output["role"] for output in payload["outputs"]] == [
        "data",
        "technical_analysis",
        "news_geopolitics",
        "risk_decision",
    ]
    assert all("summary" in output for output in payload["outputs"])
    assert all(isinstance(output["confidence"], float) for output in payload["outputs"])

    get_settings.cache_clear()


def test_latest_analysis_route_returns_last_run(monkeypatch, tmp_path: Path) -> None:
    configure_analysis_env(monkeypatch, tmp_path)
    monkeypatch.setenv("AI_PROVIDER", "mock")
    get_settings.cache_clear()

    with TestClient(app) as client:
        run_response = client.post(
            "/api/analysis/run",
            json={"symbol": "BTC/USDT", "timeframe": "1m"},
        )
        latest_response = client.get(
            "/api/analysis/latest",
            params={"symbol": "BTC/USDT", "timeframe": "1m"},
        )
        events_response = client.get("/api/events/recent", params={"limit": 20})

    assert run_response.status_code == 200
    assert latest_response.status_code == 200
    assert latest_response.json()["run_id"] == run_response.json()["run_id"]
    event_types = [event["event_type"] for event in events_response.json()]
    assert "agent.analysis.completed" in event_types
    assert "agent.role.completed" in event_types

    get_settings.cache_clear()


def test_news_role_includes_source_linked_macro_evidence(monkeypatch, tmp_path: Path) -> None:
    configure_analysis_env(monkeypatch, tmp_path)
    monkeypatch.setenv("AI_PROVIDER", "mock")
    get_settings.cache_clear()

    with TestClient(app) as client:
        response = client.post(
            "/api/analysis/run",
            json={"symbol": "BTC/USDT", "timeframe": "1m"},
        )

    assert response.status_code == 200
    payload = response.json()
    news_role = next(
        output for output in payload["outputs"] if output["role"] == "news_geopolitics"
    )
    assert news_role["sources"]
    assert any(source["url"] for source in news_role["sources"])
    assert news_role["macro_thesis"] is not None
    assert news_role["macro_thesis"]["catalysts"]
    assert news_role["macro_thesis"]["watch_items"]

    get_settings.cache_clear()


def test_provider_factory_selects_openai_compatible_when_configured(monkeypatch, tmp_path: Path) -> None:
    configure_analysis_env(monkeypatch, tmp_path)
    monkeypatch.setenv("AI_PROVIDER", "openai_compatible")
    monkeypatch.setenv("AI_API_KEY", "test-key")
    monkeypatch.setenv("AI_BASE_URL", "https://example.invalid/v1")
    monkeypatch.setenv("AI_MODEL", "test-model")
    get_settings.cache_clear()

    selection = ProviderFactory(get_settings()).resolve()

    assert isinstance(selection.provider, OpenAICompatibleProvider)
    assert selection.provider.name == "openai_compatible"
    assert selection.provider.model == "test-model"
    assert selection.fallback_reason is None

    get_settings.cache_clear()


def test_openai_candidate_urls_prefer_v1_path() -> None:
    assert _candidate_urls("https://example.com") == [
        "https://example.com/v1/responses",
    ]
    assert _candidate_urls("https://example.com/v1") == [
        "https://example.com/v1/responses",
    ]


def test_extract_response_text_supports_responses_api_shape() -> None:
    payload = {
        "output": [
            {
                "content": [
                    {
                        "type": "output_text",
                        "text": '{"signal_bias":"neutral","recommendation":"hold","confidence":0.5,"summary":"ok","rationale":["r1"],"evidence":[],"sources":[]}',
                    }
                ]
            }
        ]
    }

    assert _extract_response_text(payload).startswith('{"signal_bias":"neutral"')


def test_normalize_provider_payload_coerces_common_model_schema_drift() -> None:
    payload = _extract_json_object(
        '{"signal_bias":"neutral","recommendation":"Hold / no-trade","confidence":0.31,'
        '"summary":"thin edge","rationale":["r1"],'
        '"evidence":{"symbol":"BTC/USDT","market_source":"mock"},'
        '"sources":["user-provided market snapshot only"]}'
    )

    normalized = _normalize_provider_payload(payload, role="data")

    assert normalized["recommendation"] == "wait"
    assert normalized["evidence"] == [
        {"label": "Symbol", "detail": "BTC/USDT", "kind": "market"},
        {"label": "Market Source", "detail": "mock", "kind": "market"},
    ]
    assert normalized["sources"] == [
        {
            "title": "user-provided market snapshot only",
            "kind": "internal",
            "url": None,
            "note": None,
        }
    ]


def test_analysis_falls_back_to_mock_when_provider_errors(monkeypatch, tmp_path: Path) -> None:
    configure_analysis_env(monkeypatch, tmp_path)
    monkeypatch.setenv("AI_PROVIDER", "openai_compatible")
    monkeypatch.setenv("AI_API_KEY", "test-key")
    monkeypatch.setenv("AI_BASE_URL", "https://example.invalid/v1")
    monkeypatch.setenv("AI_MODEL", "test-model")
    get_settings.cache_clear()

    async def fail_generate(self, *, role, system_prompt, user_prompt):
        raise RuntimeError("upstream unavailable")

    monkeypatch.setattr(OpenAICompatibleProvider, "generate", fail_generate)

    with TestClient(app) as client:
        response = client.post(
            "/api/analysis/run",
            json={"symbol": "BTC/USDT", "timeframe": "1m"},
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "fallback"
    assert all(output["provider"] == "mock" for output in payload["outputs"])
    assert all(output["status"] == "fallback" for output in payload["outputs"])

    get_settings.cache_clear()
