#!/usr/bin/env python3
import os
import sys
import datetime
import sqlite3
import numpy as np
import pandas as pd

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)
from db_connector import get_wal_connection

# Import canonical backtest from quant-lttd-ichimoku
ICHIMOKU_DIR = os.path.join(BASE_DIR, "engines/ichimoku/src")
if ICHIMOKU_DIR not in sys.path:
    sys.path.insert(0, ICHIMOKU_DIR)
from ichimoku_quant import backtest

def simulate_studio_backtest_ts(data_rows, start_date, end_date, fee_bps=10):
    """
    Exact Python simulation of useStudioBacktest() from studioBacktest.ts
    to verify 1:1 mathematical parity with Python canonical engine.
    """
    if not data_rows:
        return {}

    sorted_rows = sorted(data_rows, key=lambda x: x['date'])
    filtered = [r for r in sorted_rows if start_date <= r['date'] <= end_date]
    if not filtered:
        return {}

    date_to_idx = {r['date']: idx for idx, r in enumerate(sorted_rows)}

    strat_equity = 1.0
    market_equity = 1.0
    fee_rate = (fee_bps or 0) / 10000.0

    current_pos = 0
    entry_date = ""
    entry_price = 0
    trade_count = 0
    trade_compounded_return = 1.0

    daily_returns = []
    market_returns = []
    peak_strat = 1.0
    max_dd = 0.0
    peak_market = 1.0
    max_dd_market = 0.0

    trades = []

    for i, row in enumerate(filtered):
        sorted_idx = date_to_idx.get(row['date'], 0)
        prev_row = sorted_rows[sorted_idx - 1] if sorted_idx > 0 else None

        active_pos = prev_row['position'] if prev_row else 0
        prev_active_pos = sorted_rows[sorted_idx - 2]['position'] if sorted_idx > 1 else 0

        market_ret = (row['close'] - prev_row['close']) / prev_row['close'] if (prev_row and prev_row['close'] > 0) else 0.0
        tc = abs(active_pos - prev_active_pos) * fee_rate
        strat_ret = active_pos * market_ret - tc

        if active_pos != current_pos:
            if current_pos == 1:
                net_ret = trade_compounded_return - 1.0
                trade_count += 1
                trades.append({
                    'id': f'trade-{trade_count}',
                    'entryDate': entry_date,
                    'entryPrice': entry_price,
                    'exitDate': row['date'],
                    'exitPrice': row['close'],
                    'returnPct': net_ret * 100.0,
                })
            if active_pos == 1:
                entry_date = row['date']
                entry_price = row['close']
                trade_compounded_return = 1.0
            current_pos = active_pos

        if active_pos == 1:
            trade_compounded_return *= (1.0 + strat_ret)

        strat_equity *= (1.0 + strat_ret)
        market_equity *= (1.0 + market_ret)

        daily_returns.append(strat_ret)
        market_returns.append(market_ret)

        if strat_equity > peak_strat:
            peak_strat = strat_equity
        dd = (peak_strat - strat_equity) / peak_strat
        if dd > max_dd:
            max_dd = dd

        if market_equity > peak_market:
            peak_market = market_equity
        dd_market = (peak_market - market_equity) / peak_market
        if dd_market > max_dd_market:
            max_dd_market = dd_market

    wins = sum(1 for t in trades if t['returnPct'] > 0)
    total_gain = sum(t['returnPct'] for t in trades if t['returnPct'] > 0)
    total_loss = sum(abs(t['returnPct']) for t in trades if t['returnPct'] <= 0)

    win_rate = round((wins / len(trades) * 100.0), 1) if trades else 0.0
    profit_factor = round((total_gain / total_loss), 2) if total_loss > 0 else (99.99 if total_gain > 0 else 0.0)

    sharpe_ratio = 0.0
    ann_return_strat = 0.0
    ann_volatility_strat = 0.0
    sharpe_ratio_market = 0.0
    ann_return_market = 0.0
    ann_volatility_market = 0.0

    if len(daily_returns) > 1:
        ann_factor = 365.25
        mean_ret = sum(daily_returns) / len(daily_returns)
        variance = sum((x - mean_ret) ** 2 for x in daily_returns) / (len(daily_returns) - 1)
        std_dev = np.sqrt(variance)
        ann_return_strat = mean_ret * ann_factor * 100.0
        ann_volatility_strat = std_dev * np.sqrt(ann_factor) * 100.0
        if std_dev > 0:
            sharpe_ratio = round((mean_ret / std_dev) * np.sqrt(ann_factor), 2)

        mean_mkt = sum(market_returns) / len(market_returns)
        var_mkt = sum((x - mean_mkt) ** 2 for x in market_returns) / (len(market_returns) - 1)
        std_mkt = np.sqrt(var_mkt)
        ann_return_market = mean_mkt * ann_factor * 100.0
        ann_volatility_market = std_mkt * np.sqrt(ann_factor) * 100.0
        if std_mkt > 0:
            sharpe_ratio_market = round((mean_mkt / std_mkt) * np.sqrt(ann_factor), 2)

    return {
        'winRate': win_rate,
        'profitFactor': profit_factor,
        'totalTrades': len(trades),
        'sharpeRatio': sharpe_ratio,
        'maxDrawdown': round(max_dd * 100.0, 1),
        'totalReturnStrat': round((strat_equity - 1.0) * 100.0, 1),
        'totalReturnMarket': round((market_equity - 1.0) * 100.0, 1),
        'annReturnStrat': round(ann_return_strat, 1),
        'annVolatilityStrat': round(ann_volatility_strat, 1),
        'maxDrawdownMarket': round(max_dd_market * 100.0, 1),
        'sharpeRatioMarket': sharpe_ratio_market,
        'annReturnMarket': round(ann_return_market, 1),
        'annVolatilityMarket': round(ann_volatility_market, 1),
    }

def main():
    print("==========================================================================")
    print(" ICHIMOKU STUDIO METRICS 1:1 PARITY VERIFICATION HARNESS")
    print("==========================================================================")
    conn = get_wal_connection("/home/ubuntu/projects/quant.maftia.tech/data/maftia_quant.db")
    cursor = conn.cursor()
    cursor.execute("""
        SELECT date, btc_price, ichimoku_position, ichi_ref_pos, ichi_chikou,
               lttd_regime, lttd_prob_sideways, valuation_composite
        FROM unified_daily_analytics
        WHERE date IS NOT NULL AND btc_price IS NOT NULL
        ORDER BY date ASC
    """)
    rows = cursor.fetchall()
    conn.close()

    if not rows:
        print("[ERROR] No data found in unified_daily_analytics!")
        sys.exit(1)

    print(f"Loaded {len(rows)} daily records from maftia_quant.db.")

    data_rows = []
    for r in rows:
        # Use ichimoku_position matching what IchimokuTerminal.tsx passes into useStudioBacktest
        data_rows.append({
            'date': r[0],
            'close': float(r[1]),
            'position': float(r[2]) if r[2] is not None else 0.0,
            'ichimoku_chikou': float(r[4]) if r[4] is not None else None,
            'lttd_regime': r[5],
            'lttd_prob_sideways': float(r[6]) if r[6] is not None else 0.0,
            'valuation_composite': float(r[7]) if r[7] is not None else 0.0,
        })

    # Test exact alignment across windows
    test_windows = [
        ("2018-01-01", data_rows[-1]['date'], "Default Window (2018-01-01 -> NOW)"),
        ("2011-01-01", data_rows[-1]['date'], "Post-Warmup History Window (2011-01-01 -> NOW)"),
    ]

    total_checks = 0
    passed_checks = 0

    # For canonical backtest.py, we run once on full df first to get causal shifts/TC across boundary correctly
    df = pd.DataFrame(data_rows)
    df_sorted = df.sort_values('date').reset_index(drop=True)
    df_full = df_sorted.copy()
    df_full['Pos'] = df_full['position']
    df_full['Close'] = df_full['close']
    df_bt_full = backtest.run_backtest(df_full, transaction_cost=0.001)

    for start_date, end_date, window_label in test_windows:
        print(f"\n--- Verifying Window: {window_label} ({start_date} to {end_date}) ---")

        # 1. Run simulated studioBacktest.ts
        studio_metrics = simulate_studio_backtest_ts(data_rows, start_date, end_date, fee_bps=10)

        # 2. Slice Python backtest output and rebase cumulative return inside window
        df_bt_win = df_bt_full[(df_bt_full['date'] >= start_date) & (df_bt_full['date'] <= end_date)].copy()
        df_bt_win['Cum_Market'] = (1.0 + df_bt_win['Market_Ret']).cumprod() - 1.0
        df_bt_win['Cum_Strat'] = (1.0 + df_bt_win['Strat_Net_Ret']).cumprod() - 1.0
        python_metrics = backtest.calculate_metrics(df_bt_win)

        # Compare keys
        comparisons = [
            ("Win Rate (%)", studio_metrics['winRate'], round(python_metrics.get('Win Rate (%)', 0.0), 1)),
            ("Profit Factor", studio_metrics['profitFactor'], round(python_metrics.get('Profit Factor', 0.0), 2)),
            ("Number of Trades", studio_metrics['totalTrades'], int(python_metrics.get('Number of Trades', 0))),
            ("Sharpe Ratio", studio_metrics['sharpeRatio'], round(python_metrics.get('Sharpe Ratio', 0.0), 2)),
            ("Max Drawdown (%)", studio_metrics['maxDrawdown'], round(python_metrics.get('Max Drawdown (%)', 0.0), 1)),
            ("Total Return (%)", studio_metrics['totalReturnStrat'], round(python_metrics.get('Total Return (%)', 0.0), 1)),
            ("Market Total Return (%)", studio_metrics['totalReturnMarket'], round(python_metrics.get('Market Total Return (%)', 0.0), 1)),
            ("Ann. Return (%)", studio_metrics['annReturnStrat'], round(python_metrics.get('Ann. Return (%)', 0.0), 1)),
            ("Ann. Volatility (%)", studio_metrics['annVolatilityStrat'], round(python_metrics.get('Ann. Volatility (%)', 0.0), 1)),
            ("Market Max Drawdown (%)", studio_metrics['maxDrawdownMarket'], round(python_metrics.get('Market Max Drawdown (%)', 0.0), 1)),
            ("Market Sharpe Ratio", studio_metrics['sharpeRatioMarket'], round(python_metrics.get('Market Sharpe Ratio', 0.0), 2)),
        ]

        for label, studio_val, python_val in comparisons:
            total_checks += 1
            diff = abs(studio_val - python_val) if isinstance(studio_val, (int, float)) and isinstance(python_val, (int, float)) else 999
            if diff <= 1e-6:
                passed_checks += 1
                print(f"  [PASS] {label:<25} Studio={studio_val:<10} Python={python_val:<10} (Exact 1:1 Match)")
            else:
                print(f"  [FAIL] {label:<25} Studio={studio_val:<10} Python={python_val:<10} (Diff={diff:.6f})")

    print("\n==========================================================================")
    print(f" SUMMARY: {passed_checks}/{total_checks} ({passed_checks/total_checks*100.0:.1f}%) Assertions Passed Cleanly!")
    print("==========================================================================")
    if passed_checks == total_checks:
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == "__main__":
    main()
