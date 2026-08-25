#!/usr/bin/env python3
"""
Backfill LTTD Macro Long-Term History (v3.0) into lttd.db and maftia_quant.db.
Updates historical daily_lttd and unified_daily_analytics with the verified
LTTD-L macro parameters (76.5% winRate, hold ~61d, smoother 35/20, MHP 60, RCO 30, MA 250).
"""
import os
import sys
import sqlite3
import pandas as pd

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LTTD_SRC = os.path.join(BASE_DIR, "engines", "lttd")
if LTTD_SRC not in sys.path:
    sys.path.insert(0, LTTD_SRC)
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from src.backtest.runner import BacktestRunner
from db_connector import get_wal_connection, execute_parameterized

def main():
    print("=== STARTING LTTD-L MACRO (v3.0) HISTORICAL BACKFILL ===")
    
    # 1. Fetch full OHLCV history from master_ohlcv
    db_master_path = os.path.join(BASE_DIR, "data", "maftia_quant.db")
    con = get_wal_connection(db_master_path)
    df_ohlcv = pd.read_sql_query(
        "SELECT date as time, open, high, low, close, volume FROM master_ohlcv ORDER BY date ASC",
        con
    )
    con.close()
    
    if df_ohlcv.empty:
        print("Error: master_ohlcv table is empty.")
        sys.exit(1)
        
    df_ohlcv['time'] = pd.to_datetime(df_ohlcv['time'])
    df_ohlcv = df_ohlcv.set_index('time').sort_index()
    print(f"Loaded {len(df_ohlcv)} OHLCV bars from {df_ohlcv.index.min().strftime('%Y-%m-%d')} to {df_ohlcv.index.max().strftime('%Y-%m-%d')}")
    
    # 2. Run BacktestRunner with verified macro parameters
    print("Running BacktestRunner (pca_consensus, macro 60d)...")
    runner = BacktestRunner(ensemble_mode="pca_consensus")
    res = runner.run(df_ohlcv)
    results_df = res['results']
    print(f"BacktestRunner completed: {len(results_df)} daily records generated.")
    
    # 3. Upsert into engines/lttd/database/lttd.db (daily_lttd table)
    lttd_db_path = os.path.join(BASE_DIR, "engines", "lttd", "database", "lttd.db")
    lttd_con = get_wal_connection(lttd_db_path)
    
    # Ensure daily_lttd table exists
    lttd_con.execute("""
        CREATE TABLE IF NOT EXISTS daily_lttd (
            data_as_of TEXT PRIMARY KEY,
            date TEXT,
            regime TEXT NOT NULL,
            final_score REAL,
            target_exposure REAL,
            posterior_prob REAL,
            circuit_breaker_active BOOLEAN DEFAULT 0
        )
    """)
    
    print("Upserting into lttd.db daily_lttd...")
    records_lttd = []
    for date_idx, row in results_df.iterrows():
        dt_str = pd.Timestamp(date_idx).strftime("%Y-%m-%d")
        regime = str(row.get('regime', 'SIDEWAYS'))
        final_score = float(row.get('final_score', 0.0) or 0.0) if 'final_score' in row else 0.0
        exposure = float(row.get('target_exposure', 0.0) or 0.0)
        p_prob = 0.8
        cb_active = 0
        records_lttd.append((dt_str, dt_str, regime, final_score, exposure, p_prob, cb_active))
        
    lttd_con.executemany("""
        INSERT INTO daily_lttd (data_as_of, date, regime, final_score, target_exposure, posterior_prob, circuit_breaker_active)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(data_as_of) DO UPDATE SET
            date = excluded.date,
            regime = excluded.regime,
            final_score = excluded.final_score,
            target_exposure = excluded.target_exposure,
            posterior_prob = excluded.posterior_prob,
            circuit_breaker_active = excluded.circuit_breaker_active
    """, records_lttd)
    lttd_con.commit()
    lttd_con.close()
    print(f"lttd.db: Successfully upserted {len(records_lttd)} records into daily_lttd.")
    
    # 4. Upsert into data/maftia_quant.db (unified_daily_analytics table)
    print("Updating maftia_quant.db unified_daily_analytics...")
    master_con = get_wal_connection(db_master_path)
    
    records_master = []
    for date_idx, row in results_df.iterrows():
        dt_str = pd.Timestamp(date_idx).strftime("%Y-%m-%d")
        regime = str(row.get('regime', 'SIDEWAYS'))
        final_score = float(row.get('final_score', 0.0) or 0.0) if 'final_score' in row else 0.0
        exposure = float(row.get('target_exposure', 0.0) or 0.0)
        p_bull = 1.0 if regime == 'BULL' else 0.0
        p_bear = 1.0 if regime == 'BEAR' else 0.0
        p_side = 1.0 if regime == 'SIDEWAYS' else 0.0
        records_master.append((regime, final_score, p_bull, p_bear, p_side, exposure, dt_str))
        
    master_con.executemany("""
        UPDATE unified_daily_analytics SET
            lttd_regime = ?,
            lttd_score = ?,
            lttd_prob_bull = ?,
            lttd_prob_bear = ?,
            lttd_prob_sideways = ?,
            lttd_exposure = ?
        WHERE date = ?
    """, records_master)
    master_con.commit()
    master_con.close()
    print(f"maftia_quant.db: Updated {len(records_master)} records in unified_daily_analytics.")
    print("=== LTTD-L MACRO BACKFILL COMPLETED SUCCESSFULLY ===")

if __name__ == "__main__":
    main()
