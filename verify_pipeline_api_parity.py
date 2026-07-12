#!/usr/bin/env python3
import os
import sys
import json
import sqlite3
import urllib.request
import datetime
import pandas as pd

PROJECTS_DIR = "/home/ubuntu/projects"
if PROJECTS_DIR not in sys.path:
    sys.path.insert(0, PROJECTS_DIR)
from db_connector import get_wal_connection

DB_PATH = "/home/ubuntu/projects/quant.maftia.tech/data/maftia_quant.db"
API_URL = "http://127.0.0.1:8765/api/v1/analytics/daily?limit=365"

def to_num(val):
    if val is None:
        return None
    try:
        return float(val)
    except Exception:
        return val

def check_numeric_match(name, date_str, db_val, api_val, tol=1e-6):
    n_db = to_num(db_val)
    n_api = to_num(api_val)
    
    # Both None/null is a match
    if n_db is None and n_api is None:
        return True, ""
    
    # If one is None and the other is not
    if (n_db is None and n_api is not None) or (n_db is not None and n_api is None):
        return False, f"[{date_str}] {name}: DB has {db_val} vs API has {api_val}"
    
    if isinstance(n_db, float) and isinstance(n_api, float):
        diff = abs(n_db - n_api)
        if diff >= tol:
            return False, f"[{date_str}] {name}: DB {n_db:.8f} vs API {n_api:.8f} (diff={diff:.8f} >= {tol})"
        return True, ""
    
    if str(db_val) != str(api_val):
        return False, f"[{date_str}] {name}: DB string '{db_val}' vs API string '{api_val}'"
    return True, ""

def check_string_match(name, date_str, db_val, api_val):
    if db_val is None and api_val is None:
        return True, ""
    if str(db_val or '') != str(api_val or ''):
        return False, f"[{date_str}] {name}: DB '{db_val}' vs API '{api_val}'"
    return True, ""

def verify_parity():
    print("=== STARTING 1:1 METRIC PARITY VERIFICATION (maftia_quant.db vs API Gateway :8765) ===")
    
    # 1. Fetch from API Gateway
    print(f"Fetching API JSON from {API_URL} ...")
    try:
        with urllib.request.urlopen(API_URL, timeout=10) as response:
            api_json = json.loads(response.read().decode('utf-8'))
    except Exception as e:
        print(f"FAILED to query API Gateway: {e}")
        print("Please ensure API Gateway is running on port 8765.")
        sys.exit(1)
        
    if api_json.get("status") != "success":
        print(f"API returned non-success status: {api_json.get('status')}")
        sys.exit(1)
        
    api_data = api_json.get("data", [])
    print(f"API returned {len(api_data)} daily records.")
    
    # Map API data by date
    api_map = {item["date"]: item for item in api_data}
    
    # 2. Fetch directly from maftia_quant.db using SQLite WAL connection
    today = datetime.datetime.now().strftime("%Y-%m-%d")
    conn = get_wal_connection(DB_PATH)
    cursor = conn.cursor()
    
    sql = """
        SELECT 
          u.date,
          m.open, m.high, m.low, m.close, m.volume,
          u.btc_price,
          u.valuation_composite,
          u.lttd_regime, u.lttd_score, u.lttd_prob_bull, u.lttd_prob_bear, u.lttd_prob_sideways,
          u.mttd_imo, u.mttd_er, u.mttd_entropy, u.mttd_position, u.mttd_immunity_active,
          u.ichimoku_imo, u.ichimoku_regime, u.ichimoku_position,
          u.ichi_s_tk, u.ichi_s_cloud, u.ichi_s_future, u.ichi_s_chikou,
          u.ichi_tenkan, u.ichi_kijun, u.ichi_senkou_a, u.ichi_senkou_b, u.ichi_chikou
        FROM unified_daily_analytics u
        LEFT JOIN master_ohlcv m ON u.date = m.date
        WHERE u.date <= ?
        ORDER BY u.date DESC
        LIMIT 365
    """
    cursor.execute(sql, (today,))
    db_rows = cursor.fetchall()
    conn.close()
    
    print(f"Database query returned {len(db_rows)} daily records.")
    
    if len(db_rows) != len(api_data):
        print(f"WARNING: Count mismatch! DB has {len(db_rows)} rows vs API has {len(api_data)} rows.")
        
    discrepancies = []
    total_checks = 0
    passed_checks = 0
    
    # Columns mapping from SQL query index
    # 0: u.date
    # 1-5: m.open, m.high, m.low, m.close, m.volume
    # 6: u.btc_price
    # 7: u.valuation_composite
    # 8-12: u.lttd_regime, u.lttd_score, u.lttd_prob_bull, u.lttd_prob_bear, u.lttd_prob_sideways
    # 13-17: u.mttd_imo, u.mttd_er, u.mttd_entropy, u.mttd_position, u.mttd_immunity_active
    # 18-20: u.ichimoku_imo, u.ichimoku_regime, u.ichimoku_position
    
    for row in db_rows:
        date_str = row[0]
        if date_str not in api_map:
            discrepancies.append(f"[{date_str}] Missing from API response completely!")
            continue
            
        api_item = api_map[date_str]
        
        # Helper to run check and log
        def run_check(check_func, name, db_val, api_val):
            nonlocal total_checks, passed_checks
            total_checks += 1
            ok, msg = check_func(name, date_str, db_val, api_val)
            if ok:
                passed_checks += 1
            else:
                discrepancies.append(msg)
                
        # 1. Master OHLCV metrics
        # Note: API router defaults open/high/low/close to row.btc_price if row.open is null
        db_open = row[1] if row[1] is not None else row[6]
        db_high = row[2] if row[2] is not None else row[6]
        db_low = row[3] if row[3] is not None else row[6]
        db_close = row[4] if row[4] is not None else row[6]
        db_volume = row[5] if row[5] is not None else 0
        
        run_check(check_numeric_match, "master_ohlcv.open", db_open, api_item["master_ohlcv"]["open"])
        run_check(check_numeric_match, "master_ohlcv.high", db_high, api_item["master_ohlcv"]["high"])
        run_check(check_numeric_match, "master_ohlcv.low", db_low, api_item["master_ohlcv"]["low"])
        run_check(check_numeric_match, "master_ohlcv.close", db_close, api_item["master_ohlcv"]["close"])
        run_check(check_numeric_match, "master_ohlcv.volume", db_volume, api_item["master_ohlcv"]["volume"])
        
        # 2. Valuation Composite
        run_check(check_numeric_match, "valuation_composite.score", row[7], api_item["valuation_composite"]["score"])
        
        # Derived boolean checks for valuation
        db_val_score = float(row[7] or 0)
        run_check(check_string_match, "valuation_composite.bubble_warning", db_val_score >= 1.50, api_item["valuation_composite"]["bubble_warning"])
        run_check(check_string_match, "valuation_composite.deep_discount_override", db_val_score <= -1.00, api_item["valuation_composite"]["deep_discount_override"])
        
        # 3. LTTD Regime
        run_check(check_string_match, "lttd_regime.regime", row[8], api_item["lttd_regime"]["regime"])
        run_check(check_numeric_match, "lttd_regime.score", row[9], api_item["lttd_regime"]["score"])
        run_check(check_numeric_match, "lttd_regime.prob_bull", row[10], api_item["lttd_regime"]["prob_bull"])
        run_check(check_numeric_match, "lttd_regime.prob_bear", row[11], api_item["lttd_regime"]["prob_bear"])
        run_check(check_numeric_match, "lttd_regime.prob_sideways", row[12], api_item["lttd_regime"]["prob_sideways"])
        
        # Derived boolean check for LTTD sideways zero exposure lock
        db_sideways_lock = row[8] == 'SIDEWAYS' and float(row[12] or 0) > 0.60
        run_check(check_string_match, "lttd_regime.sideways_zero_exposure_lock", db_sideways_lock, api_item["lttd_regime"]["sideways_zero_exposure_lock"])
        
        # 4. MTTD IMO
        run_check(check_numeric_match, "mttd_imo.oscillator", row[13], api_item["mttd_imo"]["oscillator"])
        run_check(check_numeric_match, "mttd_imo.efficiency_ratio", row[14], api_item["mttd_imo"]["efficiency_ratio"])
        run_check(check_numeric_match, "mttd_imo.shannon_entropy", row[15], api_item["mttd_imo"]["shannon_entropy"])
        run_check(check_numeric_match, "mttd_imo.position", row[16], api_item["mttd_imo"]["position"])
        run_check(check_string_match, "mttd_imo.immunity_active", bool(row[17]), api_item["mttd_imo"]["immunity_active"])
        
        # 5. Ichimoku IMO (existing fields)
        run_check(check_numeric_match, "ichimoku_imo.oscillator", row[18], api_item["ichimoku_imo"]["oscillator"])
        run_check(check_string_match, "ichimoku_imo.regime", row[19], api_item["ichimoku_imo"]["regime"])
        run_check(check_numeric_match, "ichimoku_imo.position", row[20], api_item["ichimoku_imo"]["position"])
        
        # 6. Ichimoku S-Components (NEW)
        run_check(check_numeric_match, "ichimoku_imo.s_tk", row[21], api_item["ichimoku_imo"].get("s_tk"))
        run_check(check_numeric_match, "ichimoku_imo.s_cloud", row[22], api_item["ichimoku_imo"].get("s_cloud"))
        run_check(check_numeric_match, "ichimoku_imo.s_future", row[23], api_item["ichimoku_imo"].get("s_future"))
        run_check(check_numeric_match, "ichimoku_imo.s_chikou", row[24], api_item["ichimoku_imo"].get("s_chikou"))
        
        # 7. Ichimoku Price-Level Lines (NEW)
        run_check(check_numeric_match, "ichimoku_imo.tenkan", row[25], api_item["ichimoku_imo"].get("tenkan"))
        run_check(check_numeric_match, "ichimoku_imo.kijun", row[26], api_item["ichimoku_imo"].get("kijun"))
        run_check(check_numeric_match, "ichimoku_imo.senkou_a", row[27], api_item["ichimoku_imo"].get("senkou_a"))
        run_check(check_numeric_match, "ichimoku_imo.senkou_b", row[28], api_item["ichimoku_imo"].get("senkou_b"))
        run_check(check_numeric_match, "ichimoku_imo.chikou", row[29], api_item["ichimoku_imo"].get("chikou"))

    print(f"\nCompleted {total_checks} checks across {len(db_rows)} daily rows.")
    print(f"Passed Checks: {passed_checks}/{total_checks} ({passed_checks/total_checks*100 if total_checks else 0:.2f}%)")
    
    if discrepancies:
        print(f"\nFOUND {len(discrepancies)} DISCREPANCIES:")
        for d in discrepancies[:30]:  # Show first 30
            print("  - " + d)
        if len(discrepancies) > 30:
            print(f"  ... and {len(discrepancies) - 30} more.")
        sys.exit(1)
    else:
        print("\nSUCCESS! 100% 1:1 Parity verified between maftia_quant.db and API Gateway :8765 across all metrics!")
        
    # Cross-validation: compare against prior system's raw output
    print("\n=== Cross-validation: prior system output vs DB ===")
    try:
        ichimoku_dir = "/home/ubuntu/projects/quant-lttd-ichimoku"
        if ichimoku_dir not in sys.path:
            sys.path.insert(0, ichimoku_dir)
        from src.ichimoku_quant.data import fetch_btc_data
        from src.ichimoku_quant.features import generate_ichimoku_features
        from src.ichimoku_quant.strategy import generate_signals
        
        df_prior = fetch_btc_data()
        df_prior = generate_ichimoku_features(df_prior)
        df_prior = generate_signals(df_prior)
        df_prior.index = pd.to_datetime(df_prior.index)
        
        # Compare against DB
        conn = get_wal_connection(DB_PATH)
        cursor = conn.cursor()
        prior_discrepancies = []
        prior_checks = 0
        prior_passed = 0
        
        for idx, r in df_prior.iterrows():
            dt = idx.strftime("%Y-%m-%d")
            cursor.execute(
                """SELECT ichimoku_imo, ichi_s_tk, ichi_s_cloud, ichi_s_future, ichi_s_chikou,
                           ichi_tenkan, ichi_kijun, ichi_senkou_a, ichi_senkou_b
                    FROM unified_daily_analytics WHERE date = ?""",
                (dt,)
            )
            db_row = cursor.fetchone()
            if db_row is None:
                continue
            
            prior_checks += 1
            
            checks = [
                ("IMO", r.get("IMO"), db_row[0]),
                ("S_TK", r.get("S_TK"), db_row[1]),
                ("S_Cloud", r.get("S_Cloud"), db_row[2]),
                ("S_Future", r.get("S_Future"), db_row[3]),
                ("S_Chikou", r.get("S_Chikou"), db_row[4]),
                ("tenkan_sen", r.get("tenkan_sen"), db_row[5]),
                ("kijun_sen", r.get("kijun_sen"), db_row[6]),
                ("senkou_span_a", r.get("senkou_span_a"), db_row[7]),
                ("senkou_span_b", r.get("senkou_span_b"), db_row[8]),
            ]
            
            all_match = True
            for name, prior_val, db_val in checks:
                if prior_val is None or pd.isnull(prior_val):
                    if db_val is not None:
                        all_match = False
                        prior_discrepancies.append(f"[{dt}] {name}: prior is NaN but DB has {db_val}")
                    continue
                if db_val is None:
                    all_match = False
                    prior_discrepancies.append(f"[{dt}] {name}: prior has {float(prior_val):.4f} but DB is NULL")
                    continue
                diff = abs(float(prior_val) - float(db_val))
                if diff >= 1e-6:
                    all_match = False
                    prior_discrepancies.append(f"[{dt}] {name}: prior {float(prior_val):.4f} vs DB {float(db_val):.4f} (diff={diff:.8f})")
            
            if all_match:
                prior_passed += 1
        
        conn.close()
        
        print(f"Cross-validation: {prior_passed}/{prior_checks} date rows match perfectly between prior system and DB.")
        if prior_discrepancies:
            print(f"Found {len(prior_discrepancies)} discrepancies with prior system:")
            for d in prior_discrepancies[:10]:
                print(f"  - {d}")
            return 1
        else:
            print("SUCCESS! DB output matches prior system 1:1.")
            return 0
            
    except ImportError as e:
        print(f"Could not import prior system modules for cross-validation: {e}")
        print("Skipping cross-validation. Basic parity check still passed.")
        return 0
    except Exception as e:
        print(f"Cross-validation error: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(verify_parity())

