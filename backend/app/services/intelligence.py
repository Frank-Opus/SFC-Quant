from __future__ import annotations

import asyncio
from datetime import date, datetime, timedelta, timezone

import httpx

from app.core.config import Settings
from app.models.intelligence import (
    IntelligenceHeadline,
    IntelligenceMetric,
    IntelligenceSnapshotResponse,
    IntelligenceSourceStatus,
)

_COINGECKO_SYMBOL_IDS = {
    "BTC": "bitcoin",
    "ETH": "ethereum",
    "BNB": "binancecoin",
    "SOL": "solana",
    "XRP": "ripple",
}

_FRED_SERIES = (
    ("FEDFUNDS", "Fed Funds", "%"),
    ("DGS10", "US 10Y", "%"),
    ("DGS2", "US 2Y", "%"),
    ("DTWEXBGS", "Dollar Index", "index"),
)


class ExternalIntelligenceService:
    def __init__(self, *, settings: Settings) -> None:
        self._settings = settings
        self._cache_lock = asyncio.Lock()
        self._cache_key: tuple[str, str] | None = None
        self._cache_value: IntelligenceSnapshotResponse | None = None
        self._cache_expires_at: datetime | None = None

    async def snapshot(
        self,
        *,
        symbol: str,
        timeframe: str,
    ) -> IntelligenceSnapshotResponse:
        key = (symbol, timeframe)
        now = datetime.now(timezone.utc)
        if (
            self._cache_key == key
            and self._cache_value is not None
            and self._cache_expires_at is not None
            and self._cache_expires_at > now
        ):
            return self._cache_value

        async with self._cache_lock:
            now = datetime.now(timezone.utc)
            if (
                self._cache_key == key
                and self._cache_value is not None
                and self._cache_expires_at is not None
                and self._cache_expires_at > now
            ):
                return self._cache_value

            snapshot = await self._build_snapshot(symbol=symbol, timeframe=timeframe)
            self._cache_key = key
            self._cache_value = snapshot
            self._cache_expires_at = now + timedelta(
                seconds=self._settings.external_intel_cache_ttl_seconds
            )
            return snapshot

    def prompt_context(self, snapshot: IntelligenceSnapshotResponse) -> str:
        lines = [
            f"external_intelligence_status: {snapshot.status}",
            f"external_intelligence_summary: {snapshot.summary}",
        ]
        if snapshot.crypto:
            crypto_line = ", ".join(
                _format_metric_for_prompt(metric) for metric in snapshot.crypto[:3]
            )
            lines.append(f"external_crypto: {crypto_line}")
        if snapshot.macro:
            macro_line = ", ".join(
                _format_metric_for_prompt(metric) for metric in snapshot.macro[:4]
            )
            lines.append(f"external_macro: {macro_line}")
        if snapshot.energy:
            energy_line = ", ".join(
                _format_metric_for_prompt(metric) for metric in snapshot.energy[:2]
            )
            lines.append(f"external_energy: {energy_line}")
        if snapshot.headlines:
            lines.append(
                "external_headlines: "
                + " | ".join(headline.title for headline in snapshot.headlines[:3])
            )
        if snapshot.warnings:
            lines.append("external_warnings: " + " | ".join(snapshot.warnings))
        return "\n".join(lines)

    async def _build_snapshot(
        self,
        *,
        symbol: str,
        timeframe: str,
    ) -> IntelligenceSnapshotResponse:
        warnings: list[str] = []
        focus_asset = symbol.split("/")[0].upper()

        async with httpx.AsyncClient(timeout=15.0) as client:
            (
                crypto_result,
                macro_result,
                energy_result,
                headlines_result,
            ) = await asyncio.gather(
                self._fetch_coingecko(client=client, focus_asset=focus_asset),
                self._fetch_fred(client=client),
                self._fetch_eia(client=client),
                self._fetch_finnhub_news(client=client),
            )

        providers = [
            IntelligenceSourceStatus(
                provider="coingecko",
                configured=bool(self._settings.coingecko_api_key),
                available=crypto_result["ok"],
                detail=crypto_result["detail"],
            ),
            IntelligenceSourceStatus(
                provider="fred",
                configured=bool(self._settings.fred_api_key),
                available=macro_result["ok"],
                detail=macro_result["detail"],
            ),
            IntelligenceSourceStatus(
                provider="eia",
                configured=bool(self._settings.eia_api_key),
                available=energy_result["ok"],
                detail=energy_result["detail"],
            ),
            IntelligenceSourceStatus(
                provider="finnhub",
                configured=bool(self._settings.finnhub_api_key),
                available=headlines_result["ok"],
                detail=headlines_result["detail"],
            ),
        ]

        for result in (crypto_result, macro_result, energy_result, headlines_result):
            warnings.extend(result["warnings"])

        available_count = sum(1 for provider in providers if provider.available)
        if available_count == 0:
            status = "unavailable"
            summary = "No external intelligence providers are live right now."
        elif available_count == len(providers):
            status = "ready"
            summary = (
                "Crypto tape, macro rates, energy pricing, and headline context are live."
            )
        else:
            status = "partial"
            summary = (
                f"{available_count}/{len(providers)} external intelligence providers are live."
            )

        return IntelligenceSnapshotResponse(
            generated_at=datetime.now(timezone.utc),
            focus_symbol=symbol,
            focus_timeframe=timeframe,
            status=status,
            summary=summary,
            providers=providers,
            crypto=crypto_result["data"],
            macro=macro_result["data"],
            energy=energy_result["data"],
            headlines=headlines_result["data"],
            warnings=list(dict.fromkeys(warnings)),
        )

    async def _fetch_coingecko(
        self,
        *,
        client: httpx.AsyncClient,
        focus_asset: str,
    ) -> dict[str, object]:
        api_key = self._settings.coingecko_api_key
        if not api_key:
            return _empty_result("CoinGecko API key is not configured.")

        ids: list[str] = []
        focus_id = _COINGECKO_SYMBOL_IDS.get(focus_asset)
        if focus_id:
            ids.append(focus_id)
        ids.extend(["bitcoin", "ethereum", "binancecoin"])
        ids = list(dict.fromkeys(ids))

        try:
            response = await client.get(
                "https://api.coingecko.com/api/v3/simple/price",
                params={
                    "ids": ",".join(ids),
                    "vs_currencies": "usd",
                    "include_24hr_change": "true",
                    "x_cg_demo_api_key": api_key,
                },
            )
            response.raise_for_status()
            payload = response.json()
        except Exception as exc:
            return _failed_result(f"CoinGecko request failed: {exc}")

        label_map = {
            "bitcoin": "BTC spot",
            "ethereum": "ETH spot",
            "binancecoin": "BNB spot",
            "solana": "SOL spot",
            "ripple": "XRP spot",
        }
        metrics: list[IntelligenceMetric] = []
        for coin_id in ids:
            coin_payload = payload.get(coin_id)
            if not isinstance(coin_payload, dict) or coin_payload.get("usd") is None:
                continue
            metrics.append(
                IntelligenceMetric(
                    key=coin_id,
                    label=label_map.get(coin_id, coin_id.upper()),
                    value=float(coin_payload["usd"]),
                    unit="USD",
                    change_percent=(
                        float(coin_payload["usd_24h_change"])
                        if coin_payload.get("usd_24h_change") is not None
                        else None
                    ),
                    as_of=datetime.now(timezone.utc),
                    source="coingecko",
                    url=f"https://www.coingecko.com/en/coins/{coin_id}",
                )
            )

        if not metrics:
            return _failed_result("CoinGecko returned no usable quote data.")
        return {
            "ok": True,
            "detail": "CoinGecko crypto reference tape is live.",
            "data": metrics,
            "warnings": [],
        }

    async def _fetch_fred(self, *, client: httpx.AsyncClient) -> dict[str, object]:
        api_key = self._settings.fred_api_key
        if not api_key:
            return _empty_result("FRED API key is not configured.")

        metrics: list[IntelligenceMetric] = []
        warnings: list[str] = []
        for series_id, label, unit in _FRED_SERIES:
            try:
                response = await client.get(
                    "https://api.stlouisfed.org/fred/series/observations",
                    params={
                        "series_id": series_id,
                        "limit": 1,
                        "sort_order": "desc",
                        "file_type": "json",
                        "api_key": api_key,
                    },
                )
                response.raise_for_status()
                payload = response.json()
                observation = (payload.get("observations") or [None])[0]
                if not observation or observation.get("value") in {None, "."}:
                    warnings.append(f"FRED {series_id} returned no usable observation.")
                    continue
                metrics.append(
                    IntelligenceMetric(
                        key=series_id,
                        label=label,
                        value=float(observation["value"]),
                        unit=unit,
                        as_of=_parse_date(observation.get("date")),
                        source="fred",
                        url=f"https://fred.stlouisfed.org/series/{series_id}",
                    )
                )
            except Exception as exc:
                warnings.append(f"FRED {series_id} failed: {exc}")

        if not metrics:
            return _failed_result(
                "FRED macro data is unavailable right now.",
                warnings=warnings,
            )
        return {
            "ok": True,
            "detail": "FRED macro rates and dollar context are live.",
            "data": metrics,
            "warnings": warnings,
        }

    async def _fetch_eia(self, *, client: httpx.AsyncClient) -> dict[str, object]:
        api_key = self._settings.eia_api_key
        if not api_key:
            return _empty_result("EIA API key is not configured.")

        try:
            response = await client.get(
                "https://api.eia.gov/v2/petroleum/pri/spt/data/",
                params={
                    "frequency": "daily",
                    "data[0]": "value",
                    "facets[product][]": "EPCWTI",
                    "sort[0][column]": "period",
                    "sort[0][direction]": "desc",
                    "length": 1,
                    "api_key": api_key,
                },
            )
            response.raise_for_status()
            payload = response.json()
            record = (((payload.get("response") or {}).get("data") or [None])[0])
            if not record or record.get("value") is None:
                return _failed_result("EIA returned no usable WTI data.")
        except Exception as exc:
            return _failed_result(f"EIA request failed: {exc}")

        metric = IntelligenceMetric(
            key="WTI",
            label="WTI crude",
            value=float(record["value"]),
            unit=str(record.get("units") or "$/BBL"),
            as_of=_parse_date(record.get("period")),
            source="eia",
            url="https://www.eia.gov/dnav/pet/hist/RWTCD.htm",
        )
        return {
            "ok": True,
            "detail": "EIA energy pricing context is live.",
            "data": [metric],
            "warnings": [],
        }

    async def _fetch_finnhub_news(
        self,
        *,
        client: httpx.AsyncClient,
    ) -> dict[str, object]:
        api_key = self._settings.finnhub_api_key
        if not api_key:
            return _empty_result("Finnhub API key is not configured.")

        try:
            response = await client.get(
                "https://finnhub.io/api/v1/news",
                params={
                    "category": "crypto",
                    "token": api_key,
                },
            )
            response.raise_for_status()
            payload = response.json()
        except Exception as exc:
            return _failed_result(f"Finnhub news request failed: {exc}")

        headlines: list[IntelligenceHeadline] = []
        for item in payload[: self._settings.external_intel_news_limit]:
            if not isinstance(item, dict):
                continue
            title = str(item.get("headline") or "").strip()
            url = str(item.get("url") or "").strip()
            if not title or not url:
                continue
            headlines.append(
                IntelligenceHeadline(
                    title=title,
                    source=str(item.get("source") or "Finnhub"),
                    url=url,
                    published_at=_parse_unix(item.get("datetime")),
                    category="crypto",
                )
            )

        if not headlines:
            return _failed_result("Finnhub returned no usable crypto headlines.")
        return {
            "ok": True,
            "detail": "Finnhub crypto headlines are live.",
            "data": headlines,
            "warnings": [],
        }


def _empty_result(detail: str) -> dict[str, object]:
    return {"ok": False, "detail": detail, "data": [], "warnings": []}


def _failed_result(detail: str, *, warnings: list[str] | None = None) -> dict[str, object]:
    return {"ok": False, "detail": detail, "data": [], "warnings": warnings or [detail]}


def _parse_date(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = date.fromisoformat(value)
    except ValueError:
        return None
    return datetime(parsed.year, parsed.month, parsed.day, tzinfo=timezone.utc)


def _parse_unix(value: object) -> datetime | None:
    if value is None:
        return None
    try:
        timestamp = int(value)
    except (TypeError, ValueError):
        return None
    return datetime.fromtimestamp(timestamp, tz=timezone.utc)


def _format_metric_for_prompt(metric: IntelligenceMetric) -> str:
    change = (
        f" ({metric.change_percent:+.2f}%)"
        if metric.change_percent is not None
        else ""
    )
    unit = f" {metric.unit}" if metric.unit else ""
    return f"{metric.label} {metric.value:.2f}{unit}{change}"
