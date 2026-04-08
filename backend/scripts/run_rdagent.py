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


def main() -> int:
    _maybe_reexec_provider_venv()
    _apply_bridge_defaults()
    _ensure_repo_on_path()
    from rdagent.app.cli import app

    return int(app() or 0)


if __name__ == "__main__":
    raise SystemExit(main())
