#!/usr/bin/env python3
from __future__ import annotations

import os
import sys
from pathlib import Path

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
    current_python = Path(sys.executable).resolve()
    if not venv_python.exists():
        return
    if current_python == venv_python.resolve():
        return
    os.execv(str(venv_python), [str(venv_python), __file__, *sys.argv[1:]])


def main() -> int:
    _maybe_reexec_provider_venv()
    _ensure_repo_on_path()
    from rdagent.app.cli import app

    return int(app() or 0)


if __name__ == "__main__":
    raise SystemExit(main())
