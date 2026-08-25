#!/usr/bin/env python3
import json
import os
import sys
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
try:
    from db_connector import get_wal_connection
    from engines.valuation.quant.sdca.engine import DailyRecord, DEFAULT_SDCA_THRESHOLDS
    from engines.valuation.quant.sdca.backtest import compute_sdca_backtest
except ImportError as e:
    print(f"Error importing modules: {e}")
    sys.exit(1)

DB_PATH = "/home/ubuntu/projects/quant.maftia.tech/data/maftia_quant.db"
OUTPUT_JSON_PATH = "/home/ubuntu/projects/quant.maftia.tech/data/sdca_backtest.json"

def run_sdca_backtest():
    print("[SDCA Backend] Starting unified SDCA backtest computation...")
    try:
        conn = get_wal_connection(DB_PATH)
    except Exception as e:
        print(f"Error connecting to database: {e}")
        return

    sql = """
        SELECT
            u.date,
            COALESCE(m.close, u.btc_price) as close,
            u.valuation_composite,
            COALESCE(u.lttd_regime, 'SIDEWAYS') as lttd_regime,
            COALESCE(u.lttd_prob_bull, 0.0) as lttd_prob_bull,
            COALESCE(u.lttd_prob_sideways, 0.0) as lttd_prob_sideways,
            COALESCE(u.lttd_exposure, 0.0) as lttd_target_exposure,
            COALESCE(u.mttd_imo, 0.0) as mttd_imo,
            COALESCE(u.mttd_position, 0.0) as mttd_position,
            COALESCE(u.mttd_er, 0.0) as mttd_er,
            COALESCE(u.mttd_entropy, 2.0) as mttd_entropy,
            COALESCE(u.ichimoku_imo, 0.0) as ichimoku_imo,
            COALESCE(u.ichimoku_position, 0.0) as ichimoku_position,
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
        return
    conn.close()
    
    if df.empty:
        print("[SDCA Backend] Error: No data found.")
        return

    closes = df['close'].astype(float).values
    dates = df['date'].values
    composites = df['valuation_composite'].fillna(0.0).astype(float).values
    regimes = df['lttd_regime'].fillna('SIDEWAYS').astype(str).values
    prob_bulls = df['lttd_prob_bull'].fillna(0.0).astype(float).values
    prob_sideways = df['lttd_prob_sideways'].fillna(0.0).astype(float).values
    target_exposures = df['lttd_target_exposure'].fillna(0.0).astype(float).values
    mttd_imos = df['mttd_imo'].fillna(0.0).astype(float).values
    mttd_positions = df['mttd_position'].fillna(0.0).astype(float).values
    mttd_ers = df['mttd_er'].fillna(0.0).astype(float).values
    mttd_entropies = df['mttd_entropy'].fillna(2.0).astype(float).values
    ichimoku_imos = df['ichimoku_imo'].fillna(0.0).astype(float).values
    ichimoku_positions = df['ichimoku_position'].fillna(0.0).astype(float).values
    ratios = df['price_ma200_ratio'].fillna(1.0).astype(float).values
    drawdowns = df['ath_drawdown'].fillna(0.0).astype(float).values
    
    records = []
    for i in range(len(df)):
        records.append(DailyRecord(
            dates[i], closes[i], composites[i],
            regimes[i], prob_bulls[i], prob_sideways[i], target_exposures[i],
            mttd_imos[i], mttd_positions[i], mttd_ers[i], mttd_entropies[i],
            ichimoku_imos[i], ichimoku_positions[i],
            ratios[i], drawdowns[i]
        ))
    config = {
        "start_date": dates[0] if len(dates) > 0 else "2010-01-01",
        "end_date": dates[-1] if len(dates) > 0 else "2026-12-31",
        "fee_bps": 10,
        "base_dca_amount": 100.0,
        "initial_cash": 10000.0,
        "thresholds": DEFAULT_SDCA_THRESHOLDS
    }
    
    result = compute_sdca_backtest(records, config)
    
    try:
        with open(OUTPUT_JSON_PATH, 'w') as f:
            json.dump(result, f, indent=2)
        print(f"[SDCA Backend] Backtest saved successfully to {OUTPUT_JSON_PATH}")
    except Exception as e:
        print(f"[SDCA Backend] Error saving backtest: {e}")

if __name__ == "__main__":
    run_sdca_backtest()
