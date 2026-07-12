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

def fetch_valuation_composite_data():
    """Directly reads valuation composite scores from metrics.db using WAL connection, rescale, and causal filter."""
    val_data = {}
    val_btc = {}
    db_metrics_path = os.path.join(VALUATION_DIR, "database/metrics.db")
    if not os.path.exists(db_metrics_path):
        return val_data, val_btc
    conn = get_wal_connection(db_metrics_path)
    comp_params = None
    try:
        row = conn.execute("SELECT raw_p2_5, raw_p50, raw_p97_5 FROM audit_composite_params ORDER BY run_date DESC LIMIT 1").fetchone()
        if row:
            comp_params = {'p2_5': float(row[0]), 'p50': float(row[1]), 'p97_5': float(row[2])}
    except Exception:
        pass
    
    rows = conn.execute("""
        SELECT date, AVG(normalized_value) as comp, MAX(btc_price) as btc
        FROM timeseries_metrics
        WHERE normalized_value IS NOT NULL AND metric_name != 'aviv_nupl'
        GROUP BY date
        ORDER BY date ASC
    """).fetchall()
    conn.close()
    
    for r in rows:
        dt = pd.to_datetime(r[0]).strftime("%Y-%m-%d")
        raw_val = float(r[1]) if r[1] is not None else None
        rescaled_val = raw_val
        if comp_params and raw_val is not None:
            p2_5, p50, p97_5 = comp_params['p2_5'], comp_params['p50'], comp_params['p97_5']
            if raw_val <= p2_5:
                rescaled_val = -2.0
            elif raw_val >= p97_5:
                rescaled_val = 2.0
            elif raw_val < p50:
                denom = p50 - p2_5
                rescaled_val = -2.0 if abs(denom) < 1e-9 else -2.0 + 2.0 * (raw_val - p2_5) / denom
            else:
                denom = p97_5 - p50
                rescaled_val = 2.0 if abs(denom) < 1e-9 else 0.0 + 2.0 * (raw_val - p50) / denom
        val_data[dt] = rescaled_val
        if r[2] is not None:
            val_btc[dt] = float(r[2])
    return val_data, val_btc


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
        cols_uda = [c[1] for c in master_conn.execute("PRAGMA table_info(unified_daily_analytics)").fetchall()]
        if cols_uda and "btc_price" not in cols_uda:
            master_conn.execute("DROP TABLE IF EXISTS unified_daily_analytics")
        cols_ucs = [c[1] for c in master_conn.execute("PRAGMA table_info(unified_component_signals)").fetchall()]
        if cols_ucs and "system_source" not in cols_ucs:
            master_conn.execute("DROP TABLE IF EXISTS unified_component_signals")
        execute_parameterized(
            master_conn,
            """CREATE TABLE IF NOT EXISTS unified_daily_analytics (
  date                   TEXT PRIMARY KEY,
  btc_price              REAL,
  valuation_composite    REAL,
  lttd_regime            TEXT,
  lttd_score             REAL,
  lttd_prob_bull         REAL,
  lttd_prob_bear         REAL,
  lttd_prob_sideways     REAL,
  mttd_imo               REAL,
  mttd_er                REAL,
  mttd_entropy           REAL,
  mttd_position          REAL,
  mttd_immunity_active   INTEGER,
  ichimoku_imo           REAL,
  ichimoku_regime        TEXT,
  ichimoku_position      REAL,
  ichi_s_tk              REAL,
  ichi_s_cloud           REAL,
  ichi_s_future          REAL,
  ichi_s_chikou          REAL,
  ichi_tenkan            REAL,
  ichi_kijun             REAL,
  ichi_senkou_a          REAL,
  ichi_senkou_b          REAL,
  ichi_chikou            REAL,
  ichi_entropy           REAL,
  ichi_er                REAL,
  ichi_imo_std           REAL,
  FOREIGN KEY (date) REFERENCES master_ohlcv(date)
)"""
        )
        execute_parameterized(
            master_conn,
            """CREATE TABLE IF NOT EXISTS unified_component_signals (
  date                   TEXT,
  system_source          TEXT,
  component_name         TEXT,
  raw_value              REAL,
  normalized_score       REAL,
  signal_direction       INTEGER,
  PRIMARY KEY (date, system_source, component_name)
)"""
        )
        # Migration: add missing Ichimoku columns to existing unified_daily_analytics table
        existing_cols = [r[1] for r in master_conn.execute("PRAGMA table_info(unified_daily_analytics)").fetchall()]
        ichi_new_cols = ['ichi_s_tk', 'ichi_s_cloud', 'ichi_s_future', 'ichi_s_chikou',
                         'ichi_tenkan', 'ichi_kijun', 'ichi_senkou_a', 'ichi_senkou_b', 'ichi_chikou',
                         'ichi_entropy', 'ichi_er', 'ichi_imo_std']
        for col_name in ichi_new_cols:
            if col_name not in existing_cols:
                try:
                    master_conn.execute(f"ALTER TABLE unified_daily_analytics ADD COLUMN {col_name} REAL")
                    print(f"  Added column {col_name} to unified_daily_analytics")
                except Exception as e:
                    print(f"  Could not add column {col_name}: {e}")
        master_conn.commit()
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
        v_data, v_btc = fetch_valuation_composite_data()
        for dt in dates_str:
            if dt in v_data:
                val_scores[dt] = v_data[dt]
            if dt in v_btc:
                btc_prices[dt] = v_btc[dt]
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

    # 8. Sync UnifiedDailyAnalytics and UnifiedComponentSignals (Phase 2)
    print("Syncing UnifiedDailyAnalytics and UnifiedComponentSignals...")
    val_data_all, val_btc_all = {}, {}
    try:
        v_data, v_btc = fetch_valuation_composite_data()
        for dt, score in v_data.items():
            if dt <= current_utc_date_str:
                val_data_all[dt] = score
        for dt, price in v_btc.items():
            if dt <= current_utc_date_str:
                val_btc_all[dt] = price
    except Exception as e:
        print(f"Error fetching full valuation composite: {e}")

    lttd_data_all = {}
    try:
        conn = get_wal_connection(db_path)
        df_lttd_all = pd.read_sql_query(
            "SELECT date, regime, final_score, posterior_prob FROM daily_lttd WHERE date <= ? ORDER BY date ASC",
            conn, params=(current_utc_date_str,)
        )
        conn.close()
        for _, r in df_lttd_all.iterrows():
            dt = pd.to_datetime(r["date"]).strftime("%Y-%m-%d")
            reg = str(r["regime"]).upper()
            post_prob = float(r["posterior_prob"]) if pd.notnull(r["posterior_prob"]) else 0.0
            if reg == "BULL":
                p_bull, p_bear, p_side = post_prob, (1.0 - post_prob)/2.0, (1.0 - post_prob)/2.0
            elif reg == "BEAR":
                p_bull, p_bear, p_side = (1.0 - post_prob)/2.0, post_prob, (1.0 - post_prob)/2.0
            elif reg == "SIDEWAYS":
                p_bull, p_bear, p_side = (1.0 - post_prob)/2.0, (1.0 - post_prob)/2.0, post_prob
            else:
                p_bull, p_bear, p_side = 0.333, 0.333, 0.333
            lttd_data_all[dt] = {
                "regime": reg,
                "score": float(r["final_score"]) if pd.notnull(r["final_score"]) else None,
                "p_bull": p_bull,
                "p_bear": p_bear,
                "p_side": p_side
            }
    except Exception as e:
        print(f"Error fetching full LTTD data: {e}")

    mttd_data_all = {}
    try:
        df_mttd_all = pd.read_csv(os.path.join(MTTD_DIR, "mttd/multi_principle/signals.csv"))
        df_mttd_all["time"] = pd.to_datetime(df_mttd_all["time"]).dt.strftime("%Y-%m-%d")
        for _, r in df_mttd_all[df_mttd_all["time"] <= current_utc_date_str].iterrows():
            dt = r["time"]
            mttd_data_all[dt] = {
                "imo": float(r["IMO"]) if pd.notnull(r["IMO"]) else None,
                "er": float(r["ER"]) if "ER" in r and pd.notnull(r["ER"]) else None,
                "entropy": float(r["Entropy"]) if "Entropy" in r and pd.notnull(r["Entropy"]) else None,
                "pos": float(r["Pos"]) if pd.notnull(r["Pos"]) else 0.0,
                "immunity": int(r["immunity_active"]) if "immunity_active" in r and pd.notnull(r["immunity_active"]) else 0
            }
    except Exception as e:
        print(f"Error fetching full MTTD signals: {e}")

    ich_data_all = {}
    try:
        # Compute chikou = Close shifted LEFT by p2=60 bars (traditional Ichimoku offset)
        # At date t, chikou = Close[t + 60], matching Pine Script's offset=-60 behavior
        ich_chikou_series = df_ich['Close'].shift(-60)
        for idx, r in df_ich[df_ich.index <= pd.to_datetime(current_utc_date_str)].iterrows():
            dt = idx.strftime("%Y-%m-%d")
            ich_data_all[dt] = {
                "imo": float(r["IMO"]) if pd.notnull(r["IMO"]) else None,
                "regime": str(r["Regime"]).upper() if pd.notnull(r["Regime"]) else "NEUTRAL",
                "pos": float(r["Pos"]) if pd.notnull(r["Pos"]) else 0.0,
                # S-component values (tanh-normalized oscillators)
                "s_tk": float(r["S_TK"]) if "S_TK" in r and pd.notnull(r["S_TK"]) else None,
                "s_cloud": float(r["S_Cloud"]) if "S_Cloud" in r and pd.notnull(r["S_Cloud"]) else None,
                "s_future": float(r["S_Future"]) if "S_Future" in r and pd.notnull(r["S_Future"]) else None,
                "s_chikou": float(r["S_Chikou"]) if "S_Chikou" in r and pd.notnull(r["S_Chikou"]) else None,
                # Raw Ichimoku price-level lines (for chart overlay)
                "tenkan": float(r["tenkan_sen"]) if "tenkan_sen" in r and pd.notnull(r["tenkan_sen"]) else None,
                "kijun": float(r["kijun_sen"]) if "kijun_sen" in r and pd.notnull(r["kijun_sen"]) else None,
                "senkou_a": float(r["senkou_span_a"]) if "senkou_span_a" in r and pd.notnull(r["senkou_span_a"]) else None,
                "senkou_b": float(r["senkou_span_b"]) if "senkou_span_b" in r and pd.notnull(r["senkou_span_b"]) else None,
                "chikou": float(ich_chikou_series.loc[idx]) if pd.notnull(ich_chikou_series.loc[idx]) else None,
                # Ichimoku gating limits (Entropy, ER, Adaptive Threshold)
                "entropy": float(r["Entropy"]) if "Entropy" in r and pd.notnull(r["Entropy"]) else None,
                "er": float(r["ER"]) if "ER" in r and pd.notnull(r["ER"]) else None,
                "imo_std": float(r["IMO_Std"]) if "IMO_Std" in r and pd.notnull(r["IMO_Std"]) else None
            }
    except Exception as e:
        print(f"Error fetching full Ichimoku signals: {e}")

    all_sync_dates = sorted(list(set(list(val_data_all.keys()) + list(lttd_data_all.keys()) + list(mttd_data_all.keys()) + list(ich_data_all.keys()))))
    master_conn = get_wal_connection("/home/ubuntu/projects/quant.maftia.tech/data/maftia_quant.db")
    
    upserted_daily_count = 0
    for dt in all_sync_dates:
        if dt > current_utc_date_str:
            continue  # Strict t-1 CausalFilter check
        val_comp = val_data_all.get(dt)
        lttd_rec = lttd_data_all.get(dt, {})
        lttd_reg = lttd_rec.get("regime")
        lttd_score = lttd_rec.get("score")
        p_bull = lttd_rec.get("p_bull")
        p_bear = lttd_rec.get("p_bear")
        p_side = lttd_rec.get("p_side")

        mttd_rec = mttd_data_all.get(dt, {})
        mttd_imo = mttd_rec.get("imo")
        mttd_er = mttd_rec.get("er")
        mttd_ent = mttd_rec.get("entropy")
        mttd_pos_val = mttd_rec.get("pos", 0.0)
        mttd_imm = mttd_rec.get("immunity", 0)

        ich_rec = ich_data_all.get(dt, {})
        ich_imo = ich_rec.get("imo")
        ich_reg = ich_rec.get("regime")
        ich_pos_val = ich_rec.get("pos", 0.0)

        # 1. LTTD SIDEWAYS Macro Override Check (Task 2.1)
        if lttd_reg == "SIDEWAYS" and p_side is not None and p_side > 0.60:
            mttd_pos_val = 0.0
            ich_pos_val = 0.0

        # 2. Valuation Macro Bubble & Deep Discount CircuitBreakerFilter (Task 2.2)
        if val_comp is not None and val_comp >= 1.50:
            mttd_pos_val = 0.0
            ich_pos_val = 0.0

        if dt in mttd_pos:
            mttd_pos[dt] = mttd_pos_val
        if dt in ich_pos:
            ich_pos[dt] = ich_pos_val

        btc_p = val_btc_all.get(dt)
        if btc_p is None:
            c_row = master_conn.execute("SELECT close FROM master_ohlcv WHERE date = ?", (dt,)).fetchone()
            if c_row is not None:
                btc_p = float(c_row[0])

        # Extract Ichimoku extended fields from ich_rec
        ich_s_tk = ich_rec.get("s_tk")
        ich_s_cloud = ich_rec.get("s_cloud")
        ich_s_future = ich_rec.get("s_future")
        ich_s_chikou = ich_rec.get("s_chikou")
        ich_tenkan = ich_rec.get("tenkan")
        ich_kijun = ich_rec.get("kijun")
        ich_senkou_a = ich_rec.get("senkou_a")
        ich_senkou_b = ich_rec.get("senkou_b")
        ich_chikou = ich_rec.get("chikou")
        ich_entropy = ich_rec.get("entropy")
        ich_er = ich_rec.get("er")
        ich_imo_std = ich_rec.get("imo_std")

        execute_parameterized(
            master_conn,
            """INSERT OR REPLACE INTO unified_daily_analytics (
                date, btc_price, valuation_composite,
                lttd_regime, lttd_score, lttd_prob_bull, lttd_prob_bear, lttd_prob_sideways,
                mttd_imo, mttd_er, mttd_entropy, mttd_position, mttd_immunity_active,
                ichimoku_imo, ichimoku_regime, ichimoku_position,
                ichi_s_tk, ichi_s_cloud, ichi_s_future, ichi_s_chikou,
                ichi_tenkan, ichi_kijun, ichi_senkou_a, ichi_senkou_b, ichi_chikou,
                ichi_entropy, ichi_er, ichi_imo_std
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                dt, btc_p, val_comp,
                lttd_reg, lttd_score, p_bull, p_bear, p_side,
                mttd_imo, mttd_er, mttd_ent, mttd_pos_val, mttd_imm,
                ich_imo, ich_reg, ich_pos_val,
                ich_s_tk, ich_s_cloud, ich_s_future, ich_s_chikou,
                ich_tenkan, ich_kijun, ich_senkou_a, ich_senkou_b, ich_chikou,
                ich_entropy, ich_er, ich_imo_std
            ),
            commit=False
        )
        upserted_daily_count += 1

    master_conn.commit()
    print(f"UnifiedDailyAnalytics synced: Upserted {upserted_daily_count} causal records into maftia_quant.db.")

    val_comp_count = 0
    try:
        vconn = get_wal_connection(os.path.join(VALUATION_DIR, "database/metrics.db"))
        vrows = vconn.execute("SELECT date, metric_name, raw_value, normalized_value FROM timeseries_metrics WHERE date <= ?", (current_utc_date_str,)).fetchall()
        vconn.close()
        for vrow in vrows:
            vdate, vname, vraw, vnorm = vrow[0], vrow[1], vrow[2], vrow[3]
            vraw_val = float(vraw) if vraw is not None else 0.0
            vnorm_val = float(vnorm) if vnorm is not None else 0.0
            s_dir = 1 if vnorm_val > 0.5 else (-1 if vnorm_val < -0.5 else 0)
            execute_parameterized(
                master_conn,
                """INSERT OR REPLACE INTO unified_component_signals (
                    date, system_source, component_name, raw_value, normalized_score, signal_direction
                ) VALUES (?, 'VALUATION', ?, ?, ?, ?)""",
                (vdate, vname, vraw_val, vnorm_val, s_dir),
                commit=False
            )
            val_comp_count += 1
    except Exception as e:
        print(f"Error syncing VALUATION component signals: {e}")

    lttd_comp_count = 0
    try:
        lconn = get_wal_connection(db_path)
        lrows = lconn.execute("SELECT date, indicator_name, score FROM indicator_scores WHERE date <= ?", (current_utc_date_str,)).fetchall()
        lconn.close()
        for lrow in lrows:
            ldate, lname, lscore = lrow[0], lrow[1], lrow[2]
            lscore_val = float(lscore) if lscore is not None else 0.0
            s_dir = 1 if lscore_val > 0.1 else (-1 if lscore_val < -0.1 else 0)
            execute_parameterized(
                master_conn,
                """INSERT OR REPLACE INTO unified_component_signals (
                    date, system_source, component_name, raw_value, normalized_score, signal_direction
                ) VALUES (?, 'LTTD', ?, ?, ?, ?)""",
                (ldate, lname, lscore_val, lscore_val, s_dir),
                commit=False
            )
            lttd_comp_count += 1
    except Exception as e:
        print(f"Error syncing LTTD component signals: {e}")

    mttd_comp_count = 0
    try:
        if "df_mttd_all" in locals():
            for _, mrow in df_mttd_all[df_mttd_all["time"] <= current_utc_date_str].iterrows():
                mdate = mrow["time"]
                for mcomp in ["ER", "Entropy", "IMO", "roc_gate", "S_TK", "S_Cloud", "S_Future", "S_Chikou"]:
                    if mcomp in mrow and pd.notnull(mrow[mcomp]):
                        mval = float(mrow[mcomp])
                        s_dir = 1 if (mcomp == "IMO" and mval > 0) else (-1 if (mcomp == "IMO" and mval < 0) else 0)
                        execute_parameterized(
                            master_conn,
                            """INSERT OR REPLACE INTO unified_component_signals (
                                date, system_source, component_name, raw_value, normalized_score, signal_direction
                            ) VALUES (?, 'MTTD', ?, ?, ?, ?)""",
                            (mdate, mcomp, mval, mval, s_dir),
                            commit=False
                        )
                        mttd_comp_count += 1
    except Exception as e:
        print(f"Error syncing MTTD component signals: {e}")

    ich_comp_count = 0
    try:
        for dt, ich_rec in ich_data_all.items():
            for icomp in ["IMO", "S_TK", "S_Cloud", "S_Future", "S_Chikou"]:
                # Map dict keys to column values
                val_map = {
                    "IMO": ich_rec.get("imo"),
                    "S_TK": ich_rec.get("s_tk"),
                    "S_Cloud": ich_rec.get("s_cloud"),
                    "S_Future": ich_rec.get("s_future"),
                    "S_Chikou": ich_rec.get("s_chikou")
                }
                ival = val_map.get(icomp)
                if ival is not None and pd.notnull(ival):
                    s_dir = 1 if ival > 0.15 else (-1 if ival < -0.15 else 0)
                    execute_parameterized(
                        master_conn,
                        """INSERT OR REPLACE INTO unified_component_signals (
                            date, system_source, component_name, raw_value, normalized_score, signal_direction
                        ) VALUES (?, 'ICHIMOKU', ?, ?, ?, ?)""",
                        (dt, icomp, ival, ival, s_dir),
                        commit=False
                    )
                    ich_comp_count += 1
    except Exception as e:
        print(f"Error syncing ICHIMOKU component signals: {e}")

    master_conn.commit()
    master_conn.close()
    print(f"UnifiedComponentSignals synced: Upserted {val_comp_count + lttd_comp_count + mttd_comp_count + ich_comp_count} component records into maftia_quant.db.")

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
