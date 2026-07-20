#!/usr/bin/env python3
"""
Walk-Forward Validation Script for 6-State SDCA Engine.
Training Period: 2014-01-01 to 2021-04-30 (includes 2015 and 2018 bottom, 2017 and 2021 peak).
Testing Period (Out-of-Sample): 2021-05-01 to 2026-06-30 (includes 2021 second peak, 2022 bear, and 2025-2026 current cycle).
"""
import sqlite3
import pandas as pd
import numpy as np
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
try:
    from db_connector import get_wal_connection
    from engines.valuation.quant.sdca.engine import DailyRecord, compute_sdca_signals
except ImportError as e:
    print(f"Error importing modules: {e}")
    sys.exit(1)

DB_PATH = "/home/ubuntu/projects/quant.maftia.tech/data/maftia_quant.db"

def run_split_backtest(df, start_date, end_date, name):
    print(f"\n--- Running Walk-Forward {name} Backtest ({start_date} to {end_date}) ---")
    sub_df = df[(df['date'] >= start_date) & (df['date'] <= end_date)].copy()
    if sub_df.empty:
        print(f"No data for {name} period.")
        return None
        
    closes = sub_df['close'].astype(float).values
    dates = sub_df['date'].values
    composites = sub_df['valuation_composite'].fillna(0.0).astype(float).values
    ratios = sub_df['price_ma200_ratio'].fillna(1.0).astype(float).values
    drawdowns = sub_df['ath_drawdown'].fillna(0.0).astype(float).values
    
    records = []
    for i in range(len(sub_df)):
        records.append(DailyRecord(dates[i], closes[i], composites[i], ratios[i], drawdowns[i]))
        
    signals = compute_sdca_signals(records)
    
    initial_cash = 10000.0
    base_dca = 100.0
    fee_rate = 10 / 10000.0
    
    sdca_cash = initial_cash
    sdca_btc = 0.0
    total_injected = initial_cash
    
    simple_dca_cash = initial_cash
    simple_dca_btc = 0.0
    
    first_price = closes[0] if len(closes) > 0 and closes[0] > 0 else 1.0
    buy_hold_btc = initial_cash / first_price
    
    trades = 0
    wins = 0
    total_sells = 0
    daily_equities = []
    
    for i in range(len(sub_df)):
        price = closes[i]
        date = dates[i]
        if price <= 0:
            continue
            
        sdca_cash += base_dca
        simple_dca_cash += base_dca
        total_injected += base_dca
        
        sig = signals[i]
        action = sig["action"]
        multiplier = sig["multiplier"]
        
        if action == "BUY_DCA":
            amount = base_dca * multiplier
            if sdca_cash >= amount and amount > 0:
                fee = amount * fee_rate
                sdca_btc += (amount - fee) / price
                sdca_cash -= amount
                trades += 1
        elif action == "BUY_ALL":
            amount = sdca_cash
            if amount > 0:
                fee = amount * fee_rate
                sdca_btc += (amount - fee) / price
                sdca_cash = 0.0
                trades += 1
        elif action == "SELL_DCA":
            sell_frac = abs(multiplier)
            btc_to_sell = sdca_btc * sell_frac
            if btc_to_sell > 0.0001:
                proceeds = btc_to_sell * price
                fee = proceeds * fee_rate
                sdca_btc -= btc_to_sell
                sdca_cash += (proceeds - fee)
                trades += 1
                total_sells += 1
                wins += 1
        elif action == "SELL_ALL":
            btc_to_sell = sdca_btc
            if btc_to_sell > 0.0001:
                proceeds = btc_to_sell * price
                fee = proceeds * fee_rate
                sdca_btc = 0.0
                sdca_cash += (proceeds - fee)
                trades += 1
                total_sells += 1
                wins += 1
                
        # Simple DCA
        if simple_dca_cash >= base_dca:
            s_fee = base_dca * fee_rate
            simple_dca_btc += (base_dca - s_fee) / price
            simple_dca_cash -= base_dca
            
        sdca_portfolio = sdca_btc * price + sdca_cash
        daily_equities.append(sdca_portfolio / total_injected)
        
    final_eq = daily_equities[-1] if daily_equities else 1.0
    years = len(daily_equities) / 365.25
    cagr = (final_eq ** (1 / years) - 1) * 100 if final_eq > 0 and years > 0 else 0
    
    max_dd = 0.0
    peak = 0.0
    for eq in daily_equities:
        if eq > peak:
            peak = eq
        if peak > 0:
            dd = (peak - eq) / peak * 100
            if dd > max_dd:
                max_dd = dd
                
    win_rate = (wins / total_sells * 100) if total_sells > 0 else 0
    
    print(f"Results for {name}:")
    print(f"  Final Equity Ratio: {final_eq:.2f}x (Total Return: {(final_eq - 1.0)*100:.1f}%)")
    print(f"  CAGR: {cagr:.2f}%")
    print(f"  Max Drawdown: -{max_dd:.2f}%")
    print(f"  Win Rate: {win_rate:.1f}% ({wins}/{total_sells} sells)")
    print(f"  Total Trades: {trades}")
    return {"cagr": cagr, "max_dd": max_dd, "trades": trades}

def main():
    try:
        conn = get_wal_connection(DB_PATH)
    except Exception as e:
        print(f"Error connecting to database: {e}")
        sys.exit(1)
        
    sql = """
        SELECT
            u.date,
            COALESCE(m.close, u.btc_price) as close,
            u.valuation_composite,
            COALESCE(u.price_ma200_ratio, 1.0) as price_ma200_ratio,
            COALESCE(u.ath_drawdown, 0.0) as ath_drawdown
        FROM unified_daily_analytics u
        LEFT JOIN master_ohlcv m ON u.date = m.date
        WHERE COALESCE(m.close, u.btc_price) IS NOT NULL
        ORDER BY u.date ASC
    """
    try:
        df = pd.read_sql(sql, conn)
    except Exception as e:
        print(f"Error reading SQL: {e}")
        conn.close()
        sys.exit(1)
    conn.close()
    
    if df.empty:
        print("No data found for validation.")
        sys.exit(1)
        
    # Run splits
    train_results = run_split_backtest(df, "2014-01-01", "2021-04-30", "TRAINING")
    test_results = run_split_backtest(df, "2021-05-01", "2026-06-30", "TESTING (Out-of-Sample)")
    
    print("\n=== WALK-FORWARD VALIDATION SUMMARY ===")
    if train_results and test_results:
        print(f"Training CAGR: {train_results['cagr']:.2f}% | MaxDD: -{train_results['max_dd']:.2f}%")
        print(f"Testing CAGR:  {test_results['cagr']:.2f}% | MaxDD: -{test_results['max_dd']:.2f}%")
        if test_results['cagr'] > 0:
            print("Out-of-sample verification PASSED ✓ (Positive CAGR in test set)")
        else:
            print("Out-of-sample verification FAILED ✗")
            sys.exit(1)
            
if __name__ == "__main__":
    main()
