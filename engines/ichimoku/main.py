import sys
import os
import subprocess
import pandas as pd

from src.ichimoku_quant.data import fetch_btc_ohlcv_from_bitview
from src.ichimoku_quant.features import generate_ichimoku_features
from src.ichimoku_quant.strategy import generate_signals
from src.ichimoku_quant.backtest import (
    run_backtest,
    calculate_metrics,
    print_benchmark_comparison_table,
    run_walk_forward_validation,
)
from src.ichimoku_quant.visuals import generate_dashboard_html


def audit_critical_dates(df_bt: pd.DataFrame):
    """
    Audits the 3 critical milestone dates.
    """
    print("\n" + "=" * 80)
    print("                    CRITICAL MILESTONE DATES AUDIT MATRIX")
    print("=" * 80)

    # 1. April 5, 2022
    row_apr = df_bt.loc['2022-04-05']
    status_apr = "[PASS] PERMANENTLY REJECTED (HELD CASH)" if row_apr['Pos'] == 0.0 else "[FAIL] ERRONEOUS ENTRY"
    print(f"1. April 5, 2022 (Bear Trap Elimination)     : Close=${row_apr['Close']:>9,.2f} | Pos={row_apr['Pos']:.2f}x ({row_apr['Regime']}) -> {status_apr}")

    # 2. October 6, 2025
    row_oct = df_bt.loc['2025-10-06']
    status_oct = "[PASS] PERMANENTLY REJECTED (HELD CASH)" if row_oct['Pos'] == 0.0 else "[FAIL] ERRONEOUS ENTRY"
    print(f"2. October 6, 2025 (Exhaustion Peak Trap)    : Close=${row_oct['Close']:>9,.2f} | Pos={row_oct['Pos']:.2f}x ({row_oct['Regime']}) -> {status_oct}")

    # 3. August 23, 2026
    row_aug = df_bt.loc['2026-08-23']
    status_aug = "[PASS] CONFIRMED N-WAVE EXPANSION" if row_aug['Pos'] == 1.20 else "[FAIL] MISSED BREAKOUT"
    print(f"3. August 23, 2026 (Active Cycle Breakout)   : Close=${row_aug['Close']:>9,.2f} | Pos={row_aug['Pos']:.2f}x ({row_aug['Regime']}) -> {status_aug}")
    print("=" * 80 + "\n")


def main():
    print("=== STARTING 7-BOOK CANONICAL ICHIMOKU QUANT PIPELINE (v4.0) ===")
    print("Framework: lz-technical-indicator-architect | Standard: lz-quant-researcher")

    # 1. Fetch data
    print("\n1. Fetching historical BTC data from bitview.space...")
    df_raw = fetch_btc_ohlcv_from_bitview()
    print(f"   Data loaded: {len(df_raw)} bars from {df_raw.index.min().strftime('%Y-%m-%d')} to {df_raw.index.max().strftime('%Y-%m-%d')}")

    # 2. Generate 7-Book features
    print("2. Generating 7-Book technical indicators, denoising features & wave telemetry...")
    df = generate_ichimoku_features(df_raw)

    # 3. Generate baseline signals (for benchmark comparator)
    print("3. Generating Baseline Grid-Search benchmark signals...")
    df_base = generate_signals(df, n_wave_size=1.0, base_size=1.0, e_target_trim_size=1.0)
    df_base_bt = run_backtest(df_base, transaction_cost=0.001)
    metrics_base = calculate_metrics(df_base_bt)

    # 4. Generate 7-Book Canonical v4.0 signals
    print("4. Evaluating 7-Book Master Confluence Gate & Dynamic Multi-Tier Sizing...")
    df_7b = generate_signals(df, n_wave_size=1.20, base_size=1.00, e_target_trim_size=0.85)
    df_7b_bt = run_backtest(df_7b, transaction_cost=0.001)
    metrics_7b = calculate_metrics(df_7b_bt)

    # 5. Audit Critical Milestone Dates
    audit_critical_dates(df_7b_bt)

    # 6. Print Side-by-Side Full History Comparison
    print_benchmark_comparison_table(metrics_base, metrics_7b, title="7-BOOK CANONICAL ICHIMOKU v4.0 vs BASELINE (FULL HISTORY)")

    # 7. Strict Data Partitioning Performance Breakdown
    # In-Sample Training (2010-08-16 to 2019-12-31)
    df_is = df_7b_bt.loc[:'2019-12-31'].copy()
    df_is['Cum_Strat'] = (1 + df_is['Strat_Net_Ret'].fillna(0)).cumprod() - 1
    df_is['Cum_Market'] = (1 + df_is['Market_Ret'].fillna(0)).cumprod() - 1
    metrics_is = calculate_metrics(df_is)

    # Out-of-Sample Validation (2020-01-01 to 2023-12-31)
    df_val = df_7b_bt.loc['2020-01-01':'2023-12-31'].copy()
    df_val['Cum_Strat'] = (1 + df_val['Strat_Net_Ret'].fillna(0)).cumprod() - 1
    df_val['Cum_Market'] = (1 + df_val['Market_Ret'].fillna(0)).cumprod() - 1
    metrics_val = calculate_metrics(df_val)

    # Out-of-Sample Real Holdout Test (2024-01-01 to 2026-08-26)
    df_test = df_7b_bt.loc['2024-01-01':].copy()
    df_test['Cum_Strat'] = (1 + df_test['Strat_Net_Ret'].fillna(0)).cumprod() - 1
    df_test['Cum_Market'] = (1 + df_test['Market_Ret'].fillna(0)).cumprod() - 1
    metrics_test = calculate_metrics(df_test)

    # 2016-2026 Canonical Period Comparison
    df_base_2016 = df_base_bt[df_base_bt.index >= '2016-01-01'].copy()
    df_base_2016['Cum_Strat'] = (1 + df_base_2016['Strat_Net_Ret'].fillna(0)).cumprod() - 1
    df_base_2016['Cum_Market'] = (1 + df_base_2016['Market_Ret'].fillna(0)).cumprod() - 1
    metrics_base_2016 = calculate_metrics(df_base_2016)

    df_7b_2016 = df_7b_bt[df_7b_bt.index >= '2016-01-01'].copy()
    df_7b_2016['Cum_Strat'] = (1 + df_7b_2016['Strat_Net_Ret'].fillna(0)).cumprod() - 1
    df_7b_2016['Cum_Market'] = (1 + df_7b_2016['Market_Ret'].fillna(0)).cumprod() - 1
    metrics_7b_2016 = calculate_metrics(df_7b_2016)

    print_benchmark_comparison_table(metrics_is, metrics_val, title="TRAIN (IS: 2010-2019) vs OOS VALIDATION (2020-2023)")
    print_benchmark_comparison_table(metrics_val, metrics_test, title="OOS VALIDATION (2020-2023) vs OOS REAL TEST (2024-2026)")
    print_benchmark_comparison_table(metrics_base_2016, metrics_7b_2016, title="CANONICAL 2016-2026 BENCHMARK COMPARISON MATRIX")

    # 8. Walk-Forward Validation Engine
    print("5. Running 5-Fold Rolling Walk-Forward Validation Engine (5-Day Embargo Gap)...")
    wf_df = run_walk_forward_validation(df_raw, n_folds=5, train_ratio=0.6, embargo_days=5)
    print("\n" + "=" * 80)
    print("        5-FOLD ROLLING WALK-FORWARD VALIDATION MATRIX (5-DAY EMBARGO)")
    print("=" * 80)
    print(wf_df.to_string(index=False))
    print("=" * 80 + "\n")

    # 9. Generate interactive bento dashboard
    dashboard_path = "tmp/dashboard.html"
    print(f"6. Compiling interactive bento dashboard to {dashboard_path}...")
    generate_dashboard_html(df_7b_bt, metrics_7b, output_path=dashboard_path)

    # 10. Open in Google Chrome as per project rules
    print("7. Launching Google Chrome to display the interactive dashboard...")
    abs_path = os.path.abspath(dashboard_path)
    try:
        subprocess.Popen(["google-chrome", f"file://{abs_path}"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print("Dashboard opened successfully in Google Chrome.")
    except Exception as e:
        print(f"Warning: Could not launch Google Chrome: {e}. Opening with system default...")
        try:
            if sys.platform == 'darwin':
                subprocess.Popen(['open', abs_path])
            elif sys.platform.startswith('linux'):
                subprocess.Popen(['xdg-open', abs_path])
        except Exception:
            pass


if __name__ == "__main__":
    main()
