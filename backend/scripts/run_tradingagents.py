#!/usr/bin/env python3
from __future__ import annotations

import os
import sys
from pathlib import Path


def _candidate_repo_roots() -> list[Path]:
    configured = os.environ.get("TRADINGAGENTS_REPO", "").strip()
    roots: list[Path] = []
    if configured:
        roots.append(Path(configured).expanduser())
    roots.append(Path("/tmp/TradingAgents-CN"))
    roots.append(Path("/private/tmp/TradingAgents-CN"))
    return roots


def _ensure_repo_on_path() -> Path:
    for root in _candidate_repo_roots():
        if (root / "cli" / "main.py").exists():
            resolved = root.resolve()
            if str(resolved) not in sys.path:
                sys.path.insert(0, str(resolved))
            return resolved
    raise SystemExit(
        "TradingAgents-CN repo not found. Set TRADINGAGENTS_REPO or clone the project to /tmp/TradingAgents-CN."
    )


def main() -> int:
    _ensure_repo_on_path()
    from cli.main import main as upstream_main

    return int(upstream_main() or 0)


if __name__ == "__main__":
    raise SystemExit(main())
