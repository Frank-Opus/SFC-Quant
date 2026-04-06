from __future__ import annotations

import os
import shlex
import sys
from pathlib import Path
from typing import Literal

StrategyProviderKey = Literal["rd_agent_q", "tradingagents_cn"]

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
_PROVIDER_ENV_MAP: dict[StrategyProviderKey, str] = {
    "rd_agent_q": "RDAGENT_REPO",
    "tradingagents_cn": "TRADINGAGENTS_REPO",
}
_PROVIDER_DIR_MAP: dict[StrategyProviderKey, str] = {
    "rd_agent_q": "rdagent",
    "tradingagents_cn": "tradingagents_cn",
}


def backend_root() -> Path:
    return _BACKEND_ROOT


def provider_vendor_root() -> Path:
    configured_root = os.environ.get("DSFC_STRATEGY_PROVIDER_VENDOR_ROOT", "").strip()
    if configured_root:
        return Path(configured_root).expanduser().resolve()
    return backend_root() / "vendor" / "strategy_providers"


def provider_repo_root(provider: StrategyProviderKey) -> Path:
    return provider_vendor_root() / _PROVIDER_DIR_MAP[provider]


def provider_env_var(provider: StrategyProviderKey) -> str:
    return _PROVIDER_ENV_MAP[provider]


def configured_provider_root(provider: StrategyProviderKey) -> Path | None:
    configured = os.environ.get(provider_env_var(provider), "").strip()
    if not configured:
        return None
    return Path(configured).expanduser().resolve()


def provider_repo_candidates(provider: StrategyProviderKey) -> list[Path]:
    candidates: list[Path] = [provider_repo_root(provider)]
    configured = configured_provider_root(provider)
    if configured is not None and configured not in candidates:
        candidates.append(configured)
    return candidates


def is_provider_repo(provider: StrategyProviderKey, root: Path) -> bool:
    if provider == "rd_agent_q":
        return (root / "rdagent" / "app" / "cli.py").exists()
    return (root / "cli" / "main.py").exists()


def resolve_provider_repo(provider: StrategyProviderKey) -> Path | None:
    for candidate in provider_repo_candidates(provider):
        if is_provider_repo(provider, candidate):
            return candidate
    return None


def wrapper_script_path(provider: StrategyProviderKey) -> Path:
    script_name = "run_rdagent.py" if provider == "rd_agent_q" else "run_tradingagents.py"
    return backend_root() / "scripts" / script_name


def default_python_executable() -> str:
    return sys.executable or "python3"


def default_provider_command(provider: StrategyProviderKey) -> str:
    python = shlex.quote(default_python_executable())
    script = shlex.quote(str(wrapper_script_path(provider)))
    if provider == "rd_agent_q":
        return f"{python} {script} fin_quant"
    return f"{python} {script}"
