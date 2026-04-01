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
            "temperature": 0.2,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
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

            choices = response_payload.get("choices") or []
            if not choices:
                last_error = RuntimeError(
                    f"Provider returned no choices for role {role} from {url}"
                )
                continue

            message_content = choices[0].get("message", {}).get("content", "")
            content = _normalize_message_content(message_content)
            parsed = _extract_json_object(content)
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
        return [f"{base_url}/chat/completions"]
    return [
        f"{base_url}/v1/chat/completions",
        f"{base_url}/chat/completions",
    ]
