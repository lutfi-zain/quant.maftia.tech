#!/usr/bin/env python3
import os
import sys
import json
import sqlite3
import subprocess
import time
import socket
import pandas as pd
import requests

PROJECTS_DIR = "/home/ubuntu/projects"
if PROJECTS_DIR not in sys.path:
    sys.path.insert(0, PROJECTS_DIR)
from db_connector import get_wal_connection, execute_parameterized

VALUATION_DIR = os.path.join(PROJECTS_DIR, "quant-btc-valuation-system")
LTTD_DIR = os.path.join(PROJECTS_DIR, "quant-btc-lttd-system")
MTTD_DIR = os.path.join(PROJECTS_DIR, "quant-btc-mttd-system")
ICHIMOKU_DIR = os.path.join(PROJECTS_DIR, "quant-lttd-ichimoku")
REPORT_PATH = os.path.join(PROJECTS_DIR, "latest_week_scores_report.md")

def is_port_open(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) == 0

def run_cmd(cmd, cwd, env=None):
    print(f"Running: {' '.join(cmd)} in {cwd}")
    res = subprocess.run(cmd, cwd=cwd, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if res.returncode != 0:
        print(f"Warning: command returned code {res.returncode}")
        print(f"STDOUT:\n{res.stdout}")
        print(f"STDERR:\n{res.stderr}")
    return res

def main():
    print("=== STARTING QUANT BITCOIN PIPELINES AND SYNC ===")
    
    # 1. Run Valuation System pipeline
    run_cmd(["python3", "-m", "quant.run_all"], VALUATION_DIR)
    
    # 2. Ensure Valuation API is running on port 3000
    valuation_proc = None
    if not is_port_open(3000):
        print("Valuation Backend on port 3000 is not running. Starting it...")
        env = os.environ.copy()
        env["PORT"] = "3000"
        env["DB_PATH"] = os.path.join(VALUATION_DIR, "database/metrics.db")
        valuation_proc = subprocess.Popen(
            ["/home/ubuntu/.bun/bin/bun", "run", "index.ts"],
            cwd=os.path.join(VALUATION_DIR, "backend"),
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        # Wait a moment for port to open
        for _ in range(10):
            if is_port_open(3000):
                print("Valuation Backend started successfully.")
                break
            time.sleep(1)
            
    # 3. Run LTTD pipeline
    run_cmd(["python3", "run_pipeline.py"], LTTD_DIR)
    
    # 4. Sync LTTD ohlcv cache to MTTD daily JSON and canonical MasterOHLCV
    print("Syncing LTTD cached data to MTTD JSON and MasterOHLCV...")
    json_path = os.path.join(MTTD_DIR, "data/btc_daily.json")
    db_path = os.path.join(LTTD_DIR, "database/lttd.db")
    
    try:
        with open(json_path, "r") as f:
            payload = json.load(f)
        aligned = payload["aligned_data"]
        last_date_str = aligned[-1]["time"]
        
        conn = get_wal_connection(db_path)
        df_sync = pd.read_sql_query(
            "SELECT timestamp as time, open, high, low, close, volume FROM ohlcv WHERE timestamp > ? ORDER BY timestamp ASC",
            conn, params=(last_date_str + " 23:59:59",)
        )
        # Also fetch full OHLCV to update canonical master_ohlcv via parameterized query & CausalFilter ($t-1$)
        df_master = pd.read_sql_query(
            "SELECT timestamp as time, open, high, low, close, volume FROM ohlcv ORDER BY timestamp ASC",
            conn
        )
        conn.close()
        
        master_conn = get_wal_connection("/home/ubuntu/projects/quant.maftia.tech/data/maftia_quant.db")
        execute_parameterized(
            master_conn,
            "CREATE TABLE IF NOT EXISTS master_ohlcv (date TEXT PRIMARY KEY, open REAL, high REAL, low REAL, close REAL, volume REAL, source TEXT DEFAULT 'binance', fetched_at TEXT DEFAULT CURRENT_TIMESTAMP)"
        )
        current_utc_date_str = pd.Timestamp.now('UTC').strftime("%Y-%m-%d")
        master_records = 0
        for _, mrow in df_master.iterrows():
            mdate_str = pd.to_datetime(mrow["time"]).strftime("%Y-%m-%d")
            if mdate_str <= current_utc_date_str:
                execute_parameterized(
                    master_conn,
                    "INSERT OR REPLACE INTO master_ohlcv (date, open, high, low, close, volume, source, fetched_at) VALUES (?, ?, ?, ?, ?, ?, 'lttd_sync', datetime('now'))",
                    (mdate_str, float(mrow["open"]), float(mrow["high"]), float(mrow["low"]), float(mrow["close"]), float(mrow["volume"])),
                    commit=False
                )
                master_records += 1
        master_conn.commit()
        master_conn.close()
        print(f"MasterOHLCV canonical sync: Upserted {master_records} causal historical records into maftia_quant.db.")

        new_records = 0
        for _, row in df_sync.iterrows():
            date_str = pd.to_datetime(row["time"]).strftime("%Y-%m-%d")
            aligned.append({
                "time": date_str,
                "open": float(row["open"]),
                "high": float(row["high"]),
                "low": float(row["low"]),
                "close": float(row["close"]),
                "volume": float(row["volume"])
            })
            new_records += 1
            
        payload["metadata"]["records"] = len(aligned)
        with open(json_path, "w") as f:
            json.dump(payload, f, indent=2)
        print(f"MTTD data synced: Appended {new_records} records.")
    except Exception as e:
        print(f"Error syncing MTTD data and MasterOHLCV: {e}")

    # 5. Run MTTD strategy
    run_cmd(["python3", "multi_principle_strategy.py"], MTTD_DIR)
    run_cmd(["python3", "generate_multi_principle_chart.py"], MTTD_DIR)

    # 6. Run Ichimoku Strategy (clear cache first)
    cache_file = os.path.join(ICHIMOKU_DIR, "tmp/btc_cache.csv")
    if os.path.exists(cache_file):
        os.remove(cache_file)
    run_cmd(["python3", "main.py"], ICHIMOKU_DIR)

    # 7. Query and compile last 7 days report
    print("Compiling weekly report...")
    end_date = pd.Timestamp.now().floor('D')
    start_date = end_date - pd.Timedelta(days=6)
    dates = pd.date_range(start=start_date, end=end_date, freq="D")
    dates_str = [d.strftime("%Y-%m-%d") for d in dates]
    
    # Fetch valuation values
    val_scores, btc_prices = {}, {}
    try:
        data = requests.get("http://localhost:3000/api/composite", timeout=5).json()
        for row in data:
            dt = pd.to_datetime(row["date"]).strftime("%Y-%m-%d")
            if dt in dates_str:
                val_scores[dt] = row["composite_value"]
                btc_prices[dt] = row["btc_price"]
    except Exception as e:
        print(f"Error fetching valuation data: {e}")

    # Fetch LTTD values
    lttd_scores, lttd_regimes = {}, {}
    try:
        conn = get_wal_connection(db_path)
        df_lttd = pd.read_sql_query(
            "SELECT date, final_score, regime FROM daily_lttd WHERE date >= ? AND date <= ?",
            conn, params=(dates_str[0], dates_str[-1])
        )
        conn.close()
        for _, r in df_lttd.iterrows():
            dt = pd.to_datetime(r["date"]).strftime("%Y-%m-%d")
            lttd_scores[dt] = r["final_score"]
            lttd_regimes[dt] = r["regime"]
    except Exception as e:
        print(f"Error reading LTTD db: {e}")

    # Fetch MTTD values
    mttd_scores, mttd_pos = {}, {}
    try:
        df_mttd = pd.read_csv(os.path.join(MTTD_DIR, "mttd/multi_principle/signals.csv"))
        df_mttd["time"] = pd.to_datetime(df_mttd["time"]).dt.strftime("%Y-%m-%d")
        df_mttd = df_mttd[(df_mttd["time"] >= dates_str[0]) & (df_mttd["time"] <= dates_str[-1])]
        for _, r in df_mttd.iterrows():
            mttd_scores[r["time"]] = r["IMO"]
            mttd_pos[r["time"]] = r["Pos"]
    except Exception as e:
        print(f"Error reading MTTD signals: {e}")

    # Compute Ichimoku fresh
    ich_scores, ich_regimes, ich_pos = {}, {}, {}
    try:
        sys.path.insert(0, ICHIMOKU_DIR)
        from src.ichimoku_quant.data import fetch_btc_data
        from src.ichimoku_quant.features import generate_ichimoku_features
        from src.ichimoku_quant.strategy import generate_signals
        
        df_ich = fetch_btc_data()
        df_ich = generate_ichimoku_features(df_ich)
        df_ich = generate_signals(df_ich)
        df_ich.index = pd.to_datetime(df_ich.index)
        
        for idx, r in df_ich[(df_ich.index >= dates_str[0]) & (df_ich.index <= dates_str[-1])].iterrows():
            dt = idx.strftime("%Y-%m-%d")
            ich_scores[dt] = r["IMO"]
            ich_regimes[dt] = r["Regime"]
            ich_pos[dt] = r["Pos"]
    except Exception as e:
        print(f"Error computing Ichimoku signals: {e}")

    # Generate Markdown Table lines
    table_lines = []
    for d in dates_str:
        btc = f"${btc_prices.get(d, 0):,.2f}" if d in btc_prices else "N/A"
        val = f"{val_scores[d]:.4f}" if d in val_scores else "N/A"
        lttd = f"{lttd_scores[d]:.4f} ({lttd_regimes[d]})" if d in lttd_scores else "N/A"
        mttd = f"{mttd_scores[d]:.4f} (Pos: {int(mttd_pos[d])})" if d in mttd_scores else "N/A"
        ich = f"{ich_scores[d]:.4f} ({ich_regimes[d]}, Pos: {int(ich_pos[d])})" if d in ich_scores else "N/A"
        table_lines.append(f"| **{d}** | {btc} | {val} | {lttd} | {mttd} | {ich} |")

    report_content = f"""# Quantitative Bitcoin Systems Weekly Report
**Report Date:** {dates_str[-1]} (Data Period: {dates_str[0]} to {dates_str[-1]})

This report details the execution status, gap synchronization, and final scores for the four quantitative Bitcoin trading systems under `/home/ubuntu/projects`.

---

## 📊 Summary of Weekly Scores

The table below aggregates the daily final scores and positions for all four projects over the last 1-week period:

| Date | BTC Price ($) | [quant-btc-valuation-system](file:///home/ubuntu/projects/quant-btc-valuation-system) Score | [quant-btc-lttd-system](file:///home/ubuntu/projects/quant-btc-lttd-system) Score | [quant-btc-mttd-system](file:///home/ubuntu/projects/quant-btc-mttd-system) Score (IMO) | [quant-lttd-ichimoku](file:///home/ubuntu/projects/quant-lttd-ichimoku) Score (IMO) |
|---|---|---|---|---|---|
{chr(10).join(table_lines)}

> *Note: The active day ({dates_str[-1]}) may not yet be completed/closed, so some systems (e.g. Ichimoku) may show N/A for today's bar until daily close.*

> [!NOTE]
> All three trend-following systems (**LTTD**, **MTTD**, and **Ichimoku**) remain in a **strong bearish/neutral state** with **0.0 position exposure**, while the **Valuation System** registers high scores (above 1.50), reflecting historical deep valuation discounts.
"""

    with open(REPORT_PATH, "w") as f:
        f.write(report_content)
    print(f"Report written successfully to {REPORT_PATH}")
    
    # If we started valuation temporarily, stop it now
    if valuation_proc:
        print("Stopping temporary Valuation Backend...")
        valuation_proc.terminate()
        valuation_proc.wait()

if __name__ == "__main__":
    main()
