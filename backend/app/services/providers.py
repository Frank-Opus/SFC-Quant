import asyncio
import json
from dataclasses import dataclass
from typing import Protocol
from urllib import error, request

from app.core.config import Settings
from app.models.analysis import AgentRole, ProviderAnalysisDraft


class AIProvider(Protocol):
    name: str
    model: str

    async def generate(
        self,
        *,
        role: AgentRole,
        system_prompt: str,
        user_prompt: str,
    ) -> ProviderAnalysisDraft:
        ...


@dataclass(slots=True)
class ProviderSelection:
    provider: AIProvider
    fallback_reason: str | None = None


class MockAIProvider:
    name = "mock"
    model = "mock-primoagent-v1"

    async def generate(
        self,
        *,
        role: AgentRole,
        system_prompt: str,
        user_prompt: str,
    ) -> ProviderAnalysisDraft:
        raise RuntimeError("Mock provider output is generated inside AnalysisService")


class OpenAICompatibleProvider:
    name = "openai_compatible"

    def __init__(self, *, base_url: str, api_key: str, model: str, timeout_seconds: float) -> None:
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self.model = model
        self._timeout_seconds = timeout_seconds

    async def generate(
        self,
        *,
        role: AgentRole,
        system_prompt: str,
        user_prompt: str,
    ) -> ProviderAnalysisDraft:
        return await asyncio.to_thread(
            self._generate_sync,
            role=role,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
        )

    def _generate_sync(
        self,
        *,
        role: AgentRole,
        system_prompt: str,
        user_prompt: str,
    ) -> ProviderAnalysisDraft:
        payload = {
            "model": self.model,
            "input": [
                {
                    "role": "system",
                    "content": [{"type": "input_text", "text": system_prompt}],
                },
                {
                    "role": "user",
                    "content": [{"type": "input_text", "text": user_prompt}],
                },
            ],
            "text": {"format": {"type": "text"}},
        }
        last_error: RuntimeError | None = None
        for url in _candidate_urls(self._base_url):
            req = request.Request(
                url=url,
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {self._api_key}",
                    "Accept": "application/json",
                    "User-Agent": "dSFC-Quant/0.1",
                },
                method="POST",
            )
            try:
                with request.urlopen(req, timeout=self._timeout_seconds) as response:
                    body = response.read().decode("utf-8")
            except error.HTTPError as exc:  # pragma: no cover - depends on remote provider
                detail = exc.read().decode("utf-8", errors="ignore")
                runtime_error = RuntimeError(
                    f"OpenAI-compatible provider request failed for role {role}: {exc.code} {detail}"
                )
                if exc.code not in {404, 405}:
                    raise runtime_error from exc
                last_error = runtime_error
                continue
            except error.URLError as exc:  # pragma: no cover - depends on remote provider
                last_error = RuntimeError(
                    f"OpenAI-compatible provider unavailable for role {role}: {exc.reason}"
                )
                continue

            try:
                response_payload = json.loads(body)
            except json.JSONDecodeError:
                last_error = RuntimeError(
                    f"OpenAI-compatible provider returned non-JSON content for role {role} from {url}"
                )
                continue

            content = _extract_response_text(response_payload)
            if not content:
                last_error = RuntimeError(
                    f"Provider returned no text output for role {role} from {url}"
                )
                continue

            parsed = _normalize_provider_payload(_extract_json_object(content), role=role)
            return ProviderAnalysisDraft.model_validate(parsed)

        if last_error is not None:
            raise last_error
        raise RuntimeError(f"OpenAI-compatible provider failed for role {role}")


class ProviderFactory:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def resolve(self) -> ProviderSelection:
        provider_name = self._settings.ai_provider
        if provider_name == "mock":
            return ProviderSelection(provider=MockAIProvider())

        if provider_name == "openai_compatible":
            missing: list[str] = []
            if not self._settings.ai_api_key:
                missing.append("AI_API_KEY")
            if not self._settings.ai_base_url:
                missing.append("AI_BASE_URL")
            if not self._settings.ai_model:
                missing.append("AI_MODEL")
            if missing:
                return ProviderSelection(
                    provider=MockAIProvider(),
                    fallback_reason=(
                        "OpenAI-compatible provider is not fully configured; "
                        f"missing {', '.join(missing)}."
                    ),
                )
            return ProviderSelection(
                provider=OpenAICompatibleProvider(
                    base_url=self._settings.ai_base_url,
                    api_key=self._settings.ai_api_key,
                    model=self._settings.ai_model,
                    timeout_seconds=self._settings.ai_timeout_seconds,
                )
            )

        return ProviderSelection(
            provider=MockAIProvider(),
            fallback_reason=f"Unsupported AI_PROVIDER '{provider_name}', using mock provider instead.",
        )


def _normalize_message_content(content: object) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                parts.append(str(item.get("text", "")))
            else:
                parts.append(str(item))
        return "\n".join(part for part in parts if part)
    return str(content)


def _extract_response_text(payload: dict) -> str:
    if isinstance(payload.get("output_text"), str) and payload["output_text"].strip():
        return str(payload["output_text"]).strip()

    output = payload.get("output")
    if not isinstance(output, list):
        return ""

    parts: list[str] = []
    for item in output:
        if not isinstance(item, dict):
            continue
        content = item.get("content")
        if not isinstance(content, list):
            continue
        for block in content:
            if not isinstance(block, dict):
                continue
            if "text" in block and isinstance(block["text"], str):
                parts.append(block["text"])
            elif block.get("type") in {"output_text", "text"}:
                text = block.get("text")
                if isinstance(text, str):
                    parts.append(text)
    return "\n".join(part.strip() for part in parts if part and part.strip())


def _normalize_provider_payload(payload: dict, *, role: AgentRole) -> dict:
    default_kind = _default_evidence_kind(role)
    normalized = dict(payload)
    normalized["signal_bias"] = _normalize_signal_bias(normalized.get("signal_bias"))
    normalized["recommendation"] = _normalize_recommendation(
        normalized.get("recommendation")
    )
    normalized["confidence"] = _normalize_confidence(normalized.get("confidence"))
    normalized["summary"] = str(normalized.get("summary") or "").strip()
    normalized["rationale"] = _normalize_string_list(normalized.get("rationale"))
    normalized["evidence"] = _normalize_evidence_points(
        normalized.get("evidence"), default_kind=default_kind
    )
    normalized["sources"] = _normalize_sources(normalized.get("sources"))
    if "macro_thesis" in normalized and normalized["macro_thesis"] is not None:
        normalized["macro_thesis"] = _normalize_macro_thesis(normalized["macro_thesis"])
    return normalized


def _normalize_signal_bias(value: object) -> str:
    text = str(value or "").strip().lower()
    if text in {"bullish", "bearish", "neutral", "cautious"}:
        return text
    if any(token in text for token in ("caut", "risk-off", "defens", "uncertain")):
        return "cautious"
    if any(token in text for token in ("bull", "positive", "up", "long")):
        return "bullish"
    if any(token in text for token in ("bear", "negative", "down", "short")):
        return "bearish"
    return "neutral"


def _normalize_recommendation(value: object) -> str:
    text = str(value or "").strip().lower()
    if text in {"buy", "sell", "hold", "reduce", "wait"}:
        return text
    compact = text.replace("_", " ").replace("-", " ")
    if any(token in compact for token in ("reduce", "trim", "de risk", "de-risk")):
        return "reduce"
    if any(token in compact for token in ("no trade", "notrade", "stand aside", "wait")):
        return "wait"
    if "buy" in compact or "long" in compact:
        return "buy"
    if "sell" in compact or "short" in compact:
        return "sell"
    if "hold" in compact:
        return "hold"
    return "hold"


def _normalize_confidence(value: object) -> float:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return 0.5
    return max(0.0, min(1.0, numeric))


def _normalize_string_list(value: object) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if value is None:
        return []
    text = str(value).strip()
    return [text] if text else []


def _normalize_evidence_points(value: object, *, default_kind: str) -> list[dict]:
    if isinstance(value, list):
        items = value
    elif isinstance(value, dict):
        items = [
            {
                "label": str(key).replace("_", " ").strip().title(),
                "detail": _stringify_detail(item_value),
                "kind": default_kind,
            }
            for key, item_value in value.items()
        ]
    elif value is None:
        items = []
    else:
        items = [{"label": "Evidence", "detail": str(value).strip(), "kind": default_kind}]

    normalized: list[dict] = []
    for item in items:
        if isinstance(item, dict):
            label = str(item.get("label") or "Evidence").strip()
            detail = _stringify_detail(item.get("detail"))
            kind = _normalize_evidence_kind(item.get("kind"), default=default_kind)
        else:
            label = "Evidence"
            detail = str(item).strip()
            kind = default_kind
        if not detail:
            continue
        normalized.append({"label": label or "Evidence", "detail": detail, "kind": kind})
    return normalized


def _normalize_sources(value: object) -> list[dict]:
    if isinstance(value, list):
        items = value
    elif value is None:
        items = []
    else:
        items = [value]

    normalized: list[dict] = []
    for item in items:
        if isinstance(item, dict):
            title = str(item.get("title") or item.get("name") or "Provider source").strip()
            kind = _normalize_source_kind(item.get("kind"), title)
            url = item.get("url")
            note = item.get("note")
        else:
            title = str(item).strip()
            kind = _normalize_source_kind(None, title)
            url = None
            note = None
        if not title:
            continue
        normalized.append(
            {
                "title": title,
                "kind": kind,
                "url": str(url).strip() if isinstance(url, str) and url.strip() else None,
                "note": str(note).strip() if isinstance(note, str) and note.strip() else None,
            }
        )
    return normalized


def _normalize_macro_thesis(value: object) -> dict | None:
    if not isinstance(value, dict):
        return None
    normalized = {
        "regime": str(value.get("regime") or "unclear").strip(),
        "stance": _normalize_signal_bias(value.get("stance")),
        "summary": str(value.get("summary") or "").strip(),
    }
    catalysts = value.get("catalysts")
    if isinstance(catalysts, list):
        normalized["catalysts"] = [
            {
                "label": str(item.get("label") or "Catalyst").strip(),
                "detail": _stringify_detail(item.get("detail")),
                "impact": _normalize_signal_bias(item.get("impact")),
                "horizon": _normalize_macro_horizon(item.get("horizon")),
            }
            for item in catalysts
            if isinstance(item, dict) and _stringify_detail(item.get("detail"))
        ]
    else:
        normalized["catalysts"] = []
    watch_items = value.get("watch_items")
    if isinstance(watch_items, list):
        normalized["watch_items"] = [
            {
                "label": str(item.get("label") or "Watch item").strip(),
                "trigger": _stringify_detail(item.get("trigger")),
                "implication": _stringify_detail(item.get("implication")),
            }
            for item in watch_items
            if isinstance(item, dict)
            and _stringify_detail(item.get("trigger"))
            and _stringify_detail(item.get("implication"))
        ]
    else:
        normalized["watch_items"] = []
    return normalized


def _default_evidence_kind(role: AgentRole) -> str:
    return {
        "data": "market",
        "technical_analysis": "technical",
        "news_geopolitics": "macro",
        "risk_decision": "risk",
    }[role]


def _normalize_evidence_kind(value: object, *, default: str) -> str:
    text = str(value or "").strip().lower()
    if text in {"market", "technical", "news", "macro", "risk", "internal"}:
        return text
    return default


def _normalize_source_kind(value: object, title: str) -> str:
    text = str(value or "").strip().lower()
    if text in {"exchange", "macro", "news", "internal", "provider"}:
        return text

    title_lower = title.lower()
    if any(token in title_lower for token in ("binance", "coinbase", "bybit", "kraken", "exchange")):
        return "exchange"
    if any(token in title_lower for token in ("fed", "cpi", "ppi", "macro", "fomc", "treasury")):
        return "macro"
    if any(token in title_lower for token in ("reuters", "bloomberg", "news", "headline")):
        return "news"
    if any(token in title_lower for token in ("snapshot", "mock", "internal", "user-provided")):
        return "internal"
    return "provider"


def _normalize_macro_horizon(value: object) -> str:
    text = str(value or "").strip().lower()
    if text in {"intraday", "swing", "macro"}:
        return text
    if "day" in text or "intra" in text:
        return "intraday"
    if "swing" in text or "week" in text:
        return "swing"
    return "macro"


def _stringify_detail(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float, bool)):
        return str(value)
    return json.dumps(value, ensure_ascii=True)


def _extract_json_object(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise RuntimeError("Provider did not return a valid JSON object")
        return json.loads(text[start : end + 1])


def _candidate_urls(base_url: str) -> list[str]:
    base_url = base_url.rstrip("/")
    if base_url.endswith("/v1"):
        return [f"{base_url}/responses"]
    return [f"{base_url}/v1/responses"]
