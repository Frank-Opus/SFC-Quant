#!/usr/bin/env python3
from __future__ import annotations

import os
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
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


def main() -> int:
    _ensure_repo_on_path()
    from rdagent.app.cli import app

    return int(app() or 0)


if __name__ == "__main__":
    raise SystemExit(main())
