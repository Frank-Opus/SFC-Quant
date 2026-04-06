#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
VENDOR_ROOT="${DSFC_STRATEGY_PROVIDER_VENDOR_ROOT:-${BACKEND_ROOT}/vendor/strategy_providers}"
PYTHON_BIN="${PYTHON_BIN:-python3}"
INSTALL_EDITABLE="${INSTALL_EDITABLE:-1}"

clone_or_update() {
  local repo_url="$1"
  local target_dir="$2"

  if [ -d "${target_dir}/.git" ]; then
    git -C "${target_dir}" fetch --depth 1 origin
    git -C "${target_dir}" reset --hard origin/HEAD
    return
  fi

  rm -rf "${target_dir}"
  git clone --depth 1 "${repo_url}" "${target_dir}"
}

mkdir -p "${VENDOR_ROOT}"

clone_or_update "https://github.com/microsoft/RD-Agent.git" "${VENDOR_ROOT}/rdagent"
clone_or_update "https://github.com/hsliuping/TradingAgents-CN.git" "${VENDOR_ROOT}/tradingagents_cn"

if [ "${INSTALL_EDITABLE}" = "1" ]; then
  "${PYTHON_BIN}" -m pip install -e "${VENDOR_ROOT}/rdagent"
  "${PYTHON_BIN}" -m pip install -e "${VENDOR_ROOT}/tradingagents_cn"
fi

printf 'Strategy providers synced under %s\n' "${VENDOR_ROOT}"
