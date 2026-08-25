#!/usr/bin/env bash
set -euo pipefail
# Autoresearch harness — LTTD long-term trend, gross winRate
# Deterministic: fixed DB snapshot, fixed date range 2018-2024, fixed fee, no network
# Primary metric: winRate (gross per-trade, target >=70)
# Secondary: profitFactor, trades, hold, expectancy, sharpe
# V2: BacktestRunner code-sensitive (vectorbt, HMM, ensemble, sizing)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
python3 "$SCRIPT_DIR/scripts/autoresearch_lttd_benchmark_v2.py"
exit_code=$?
exit $exit_code
