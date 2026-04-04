#!/usr/bin/env python3
from __future__ import annotations

import os
import sys
from pathlib import Path


def _candidate_repo_roots() -> list[Path]:
    configured = os.environ.get("RDAGENT_REPO", "").strip()
    roots: list[Path] = []
    if configured:
        roots.append(Path(configured).expanduser())
    roots.append(Path("/Users/suhui/Documents/百度同步/Project_Interest/RD-Agent"))
    return roots


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
