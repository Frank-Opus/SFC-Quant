from pathlib import Path

from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app
from app.services.intelligence import ExternalIntelligenceService


def configure_intelligence_env(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("APP_MODE", "mock")
    monkeypatch.setenv("MARKET_DATA_MODE", "mock")
    monkeypatch.setenv("MARKET_SYMBOLS", "BTC/USDT")
    monkeypatch.setenv("MARKET_TIMEFRAMES", "1m")
    monkeypatch.setenv("MARKET_HISTORY_LIMIT", "4")
    monkeypatch.setenv("MARKET_STREAM_ENABLED", "false")
    monkeypatch.setenv("EVENT_LOG_DIR", str(tmp_path / "events"))
    monkeypatch.setenv("COINGECKO_API_KEY", "demo")
    monkeypatch.setenv("FRED_API_KEY", "demo")
    monkeypatch.setenv("EIA_API_KEY", "demo")
    monkeypatch.setenv("FINNHUB_API_KEY", "demo")
    get_settings.cache_clear()


async def fake_coingecko(self, *, client, focus_asset: str):
    return {
        "ok": True,
        "detail": "CoinGecko crypto reference tape is live.",
        "data": [
            {
                "key": "bitcoin",
                "label": "BTC spot",
                "value": 66795.0,
                "unit": "USD",
                "change_percent": 0.32,
                "as_of": "2026-04-04T00:00:00Z",
                "source": "coingecko",
                "url": "https://www.coingecko.com/en/coins/bitcoin",
            }
        ],
        "warnings": [],
    }


async def fake_fred(self, *, client):
    return {
        "ok": True,
        "detail": "FRED macro rates and dollar context are live.",
        "data": [
            {
                "key": "FEDFUNDS",
                "label": "Fed Funds",
                "value": 3.64,
                "unit": "%",
                "change_percent": None,
                "as_of": "2026-03-01T00:00:00Z",
                "source": "fred",
                "url": "https://fred.stlouisfed.org/series/FEDFUNDS",
            },
            {
                "key": "DGS10",
                "label": "US 10Y",
                "value": 4.31,
                "unit": "%",
                "change_percent": None,
                "as_of": "2026-04-02T00:00:00Z",
                "source": "fred",
                "url": "https://fred.stlouisfed.org/series/DGS10",
            },
        ],
        "warnings": [],
    }


async def fake_eia(self, *, client):
    return {
        "ok": True,
        "detail": "EIA energy pricing context is live.",
        "data": [
            {
                "key": "WTI",
                "label": "WTI crude",
                "value": 104.69,
                "unit": "$/BBL",
                "change_percent": None,
                "as_of": "2026-03-30T00:00:00Z",
                "source": "eia",
                "url": "https://www.eia.gov/dnav/pet/hist/RWTCD.htm",
            }
        ],
        "warnings": [],
    }


async def fake_finnhub(self, *, client):
    return {
        "ok": True,
        "detail": "Finnhub crypto headlines are live.",
        "data": [
            {
                "title": "Bitcoin ETFs remain in focus",
                "source": "Reuters",
                "url": "https://example.com/bitcoin-etf",
                "published_at": "2026-04-04T00:00:00Z",
                "category": "crypto",
            }
        ],
        "warnings": [],
    }


def patch_live_sources(monkeypatch) -> None:
    monkeypatch.setattr(ExternalIntelligenceService, "_fetch_coingecko", fake_coingecko)
    monkeypatch.setattr(ExternalIntelligenceService, "_fetch_fred", fake_fred)
    monkeypatch.setattr(ExternalIntelligenceService, "_fetch_eia", fake_eia)
    monkeypatch.setattr(ExternalIntelligenceService, "_fetch_finnhub_news", fake_finnhub)


def test_macro_intelligence_route_returns_structured_snapshot(monkeypatch, tmp_path: Path) -> None:
    configure_intelligence_env(monkeypatch, tmp_path)
    patch_live_sources(monkeypatch)

    with TestClient(app) as client:
        response = client.get(
            "/api/intelligence/macro",
            params={"symbol": "BTC/USDT", "timeframe": "1m"},
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ready"
    assert len(payload["providers"]) == 4
    assert payload["crypto"][0]["label"] == "BTC spot"
    assert payload["macro"][0]["key"] == "FEDFUNDS"
    assert payload["energy"][0]["key"] == "WTI"
    assert payload["headlines"][0]["source"] == "Reuters"

    get_settings.cache_clear()


def test_analysis_news_role_uses_external_intelligence_sources(monkeypatch, tmp_path: Path) -> None:
    configure_intelligence_env(monkeypatch, tmp_path)
    patch_live_sources(monkeypatch)
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
    source_titles = {source["title"] for source in news_role["sources"]}
    assert "CoinGecko Crypto Tape" in source_titles
    assert "FRED Macro Data" in source_titles
    assert news_role["macro_thesis"] is not None
    assert any(item["label"] == "Live headline" for item in news_role["evidence"])

    get_settings.cache_clear()
