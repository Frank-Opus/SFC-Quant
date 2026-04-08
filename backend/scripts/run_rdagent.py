#!/usr/bin/env python3
from __future__ import annotations

import os
import sys
from pathlib import Path
from urllib.parse import urlparse

BACKEND_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PROVIDER_VENV = Path(
    os.environ.get("RDAGENT_PROVIDER_VENV")
    or f"{os.environ.get('DSFC_PROVIDER_VENV_ROOT', '/opt/provider-venvs')}/rdagent"
)
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.strategy_providers import provider_repo_candidates


def _candidate_repo_roots() -> list[Path]:
    return provider_repo_candidates("rd_agent_q")


def _ensure_repo_on_path() -> None:
    for root in _candidate_repo_roots():
        if (root / "rdagent" / "app" / "cli.py").exists():
            resolved = root.resolve()
            if str(resolved) not in sys.path:
                sys.path.insert(0, str(resolved))
            return


def _maybe_reexec_provider_venv() -> None:
    venv_python = DEFAULT_PROVIDER_VENV / "bin" / "python"
    if not venv_python.exists():
        return
    if Path(sys.prefix).resolve() == DEFAULT_PROVIDER_VENV.resolve():
        return
    os.execv(str(venv_python), [str(venv_python), __file__, *sys.argv[1:]])


def _apply_bridge_defaults() -> None:
    if not (
        os.environ.get("DSFC_STRATEGY_INPUT_JSON")
        and os.environ.get("DSFC_STRATEGY_ARTIFACT_DIR")
    ):
        return
    if len(sys.argv) < 2 or sys.argv[1] != "fin_quant":
        return
    if any(arg.startswith("--loop-n") or arg.startswith("--all-duration") for arg in sys.argv[2:]):
        return

    # Bound product-internal runs so the strategy factory can return reviewable
    # artifacts instead of entering an open-ended RD loop.
    sys.argv.extend(
        [
            "--loop-n",
            os.environ.get("RDAGENT_DSFC_LOOP_N", "1"),
            "--all-duration",
            os.environ.get("RDAGENT_DSFC_ALL_DURATION", "2m"),
        ]
    )


def _normalize_openai_base_url(base_url: str) -> str:
    parsed = urlparse(base_url)
    path = parsed.path.rstrip("/")
    if path.endswith("/v1"):
        return base_url.rstrip("/")
    if not path:
        return f"{base_url.rstrip('/')}/v1"
    return base_url.rstrip("/")


def _apply_provider_env_aliases() -> None:
    api_key = os.environ.get("AI_API_KEY", "").strip()
    if api_key and not os.environ.get("OPENAI_API_KEY"):
        os.environ["OPENAI_API_KEY"] = api_key

    base_url = os.environ.get("AI_BASE_URL", "").strip()
    if base_url:
        normalized = _normalize_openai_base_url(base_url)
        os.environ.setdefault("OPENAI_API_BASE", normalized)
        os.environ.setdefault("OPENAI_BASE_URL", normalized)

    model = os.environ.get("AI_MODEL", "").strip()
    if model:
        os.environ.setdefault("CHAT_MODEL", model)
        os.environ.setdefault("OPENAI_MODEL", model)
        os.environ.setdefault("EMBEDDING_MODEL", "text-embedding-3-small")

    # Some OpenAI-compatible mirrors return `content: null` for non-streaming chat
    # completions while still emitting valid streamed deltas, so prefer streaming
    # unless the operator overrides it explicitly.
    chat_stream = os.environ.get("RDAGENT_DSFC_CHAT_STREAM", "true")
    max_retry = os.environ.get("RDAGENT_DSFC_MAX_RETRY", "2")
    timeout_fail_limit = os.environ.get("RDAGENT_DSFC_TIMEOUT_FAIL_LIMIT", "2")
    retry_wait_seconds = os.environ.get("RDAGENT_DSFC_RETRY_WAIT_SECONDS", "1")

    # RD-Agent reads generic LLM settings, while LiteLLM-specific helpers read the
    # prefixed variants. Set both so retry/stream behavior stays bounded.
    os.environ.setdefault("CHAT_STREAM", chat_stream)
    os.environ.setdefault("MAX_RETRY", max_retry)
    os.environ.setdefault("TIMEOUT_FAIL_LIMIT", timeout_fail_limit)
    os.environ.setdefault("RETRY_WAIT_SECONDS", retry_wait_seconds)

    os.environ.setdefault("LITELLM_CHAT_STREAM", chat_stream)
    os.environ.setdefault("LITELLM_MAX_RETRY", max_retry)
    os.environ.setdefault("LITELLM_TIMEOUT_FAIL_LIMIT", timeout_fail_limit)
    os.environ.setdefault("LITELLM_RETRY_WAIT_SECONDS", retry_wait_seconds)


def main() -> int:
    _maybe_reexec_provider_venv()
    _apply_provider_env_aliases()
    _apply_bridge_defaults()
    _ensure_repo_on_path()
    from rdagent.app.cli import app

    return int(app() or 0)


if __name__ == "__main__":
    raise SystemExit(main())
