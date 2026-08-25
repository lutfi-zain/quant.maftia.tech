#!/usr/bin/env bash
set -euo pipefail
# Autoresearch harness — LTTD long-term trend, gross winRate
# Deterministic: fixed DB snapshot, fixed date range 2016-2024, fixed fee, no network
# Primary metric: winRate (gross per-trade, target >=70)
# Secondary: profitFactor, trades, hold, expectancy, sharpe
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Ensure WAL checkpoint does not block read — use read-only
# Run benchmark
python3 "$SCRIPT_DIR/scripts/autoresearch_lttd_benchmark.py"
exit_code=$?
exit $exit_code
