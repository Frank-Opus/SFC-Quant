#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import sys
from datetime import datetime
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PROVIDER_VENV = Path(
    os.environ.get("TRADINGAGENTS_PROVIDER_VENV")
    or f"{os.environ.get('DSFC_PROVIDER_VENV_ROOT', '/opt/provider-venvs')}/tradingagents_cn"
)
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.strategy_providers import provider_repo_candidates


def _candidate_repo_roots() -> list[Path]:
    return provider_repo_candidates("tradingagents_cn")


def _ensure_repo_on_path() -> Path:
    for root in _candidate_repo_roots():
        if (root / "cli" / "main.py").exists():
            resolved = root.resolve()
            if str(resolved) not in sys.path:
                sys.path.insert(0, str(resolved))
            return resolved
    raise SystemExit(
        "TradingAgents-CN repo not found. Set TRADINGAGENTS_REPO or install the source into backend/vendor/strategy_providers/tradingagents_cn."
    )


def _maybe_reexec_provider_venv() -> None:
    venv_python = DEFAULT_PROVIDER_VENV / "bin" / "python"
    if not venv_python.exists():
        return
    if Path(sys.prefix).resolve() == DEFAULT_PROVIDER_VENV.resolve():
        return
    os.execv(str(venv_python), [str(venv_python), __file__, *sys.argv[1:]])


def _looks_like_stock_symbol(symbol: str) -> bool:
    normalized = symbol.strip().upper()
    if normalized.isdigit() and len(normalized) == 6:
        return True
    if normalized.endswith(".HK"):
        return True
    if normalized.isalpha() and 1 <= len(normalized) <= 5:
        return True
    return False


def _resolve_llm_provider() -> tuple[str, str]:
    if os.environ.get("DASHSCOPE_API_KEY"):
        return "dashscope", "qwen-plus"
    if os.environ.get("OPENAI_API_KEY") or os.environ.get("AI_API_KEY"):
        api_key = os.environ.get("OPENAI_API_KEY") or os.environ.get("AI_API_KEY") or ""
        os.environ.setdefault("OPENAI_API_KEY", api_key)
        return "openai", os.environ.get("AI_MODEL", "gpt-4o-mini")
    raise RuntimeError(
        "TradingAgents-CN bridge requires DASHSCOPE_API_KEY or OPENAI_API_KEY/AI_API_KEY."
    )


def _write_bridge_validation_artifact(artifact_dir: Path, payload: dict, reason: str) -> int:
    validation_path = artifact_dir / "tradingagents-validation.md"
    validation_path.write_text(
        "\n".join(
            [
                "# TradingAgents-CN Callable Validation",
                "",
                f"- Symbol: {payload.get('symbol', 'unknown')}",
                f"- Timeframe: {payload.get('timeframe', 'unknown')}",
                f"- Run ID: {payload.get('run_id', 'unknown')}",
                "",
                "## Result",
                reason,
                "",
                "The provider import path is valid, but full unattended analysis was not started for this request.",
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"generated {validation_path.name}")
    return 0


def _run_bridge_mode() -> int:
    artifact_dir = Path(os.environ["DSFC_STRATEGY_ARTIFACT_DIR"])
    input_path = Path(os.environ["DSFC_STRATEGY_INPUT_JSON"])
    payload = json.loads(input_path.read_text(encoding="utf-8"))
    symbol = str(payload.get("symbol", "")).strip()

    if not _looks_like_stock_symbol(symbol):
        return _write_bridge_validation_artifact(
            artifact_dir,
            payload,
            "Input symbol does not match the stock-oriented TradingAgents-CN bridge, so the wrapper completed import validation only.",
        )

    llm_provider, llm_model = _resolve_llm_provider()
    from web.utils.analysis_runner import run_stock_analysis

    analysis_date = datetime.utcnow().strftime("%Y-%m-%d")
    market_type = "A股" if symbol.isdigit() and len(symbol) == 6 else "港股" if symbol.upper().endswith(".HK") else "美股"
    results = run_stock_analysis(
        stock_symbol=symbol,
        analysis_date=analysis_date,
        analysts=["market", "news", "fundamentals"],
        research_depth=1,
        llm_provider=llm_provider,
        llm_model=llm_model,
        market_type=market_type,
    )

    report_path = artifact_dir / "tradingagents-report.json"
    report_path.write_text(
        json.dumps(results, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    markdown_path = artifact_dir / "tradingagents-report.md"
    markdown_path.write_text(
        "\n".join(
            [
                "# TradingAgents-CN Report",
                "",
                f"- Symbol: {symbol}",
                f"- Analysis Date: {analysis_date}",
                f"- Provider: {llm_provider}",
                "",
                "## Summary",
                str(results.get("investment_summary") or results.get("error") or "No summary returned."),
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    generated_name = markdown_path.name if results.get("success", True) else report_path.name
    print(f"generated {generated_name}")
    return 0 if results.get("success", True) else 1


def main() -> int:
    _maybe_reexec_provider_venv()
    _ensure_repo_on_path()
    if os.environ.get("DSFC_STRATEGY_INPUT_JSON") and os.environ.get("DSFC_STRATEGY_ARTIFACT_DIR"):
        return _run_bridge_mode()
    from cli.main import main as upstream_main

    return int(upstream_main() or 0)


if __name__ == "__main__":
    raise SystemExit(main())
