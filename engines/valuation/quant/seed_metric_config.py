import sqlite3
import os

DB_PATH = 'database/metrics.db'

# Threshold configurations for all metrics.
# Format: (metric_name, t_plus_2, t_plus_1, t_zero, t_minus_1, t_minus_2, rescale_method)
# We seed both the component names and any alternative spec names to ensure maximum compatibility.
SEED_DATA = [
    # Fundamental (Macro Valuation)
    ('aviv_ratio', -2.0, -1.0, None, 1.0, 2.0, 'expanding_window', 'macro_valuation'),
    ('aviv_ratio_z', -2.0, -1.0, None, 1.0, 2.0, 'expanding_window', 'macro_valuation'),
    ('aviv_nupl', -0.6, -0.3, None, 0.3, 0.5, 'none', 'macro_valuation'),
    ('cvdd_ratio', 1.0, 2.0, None, 15.0, 25.0, 'none', 'macro_valuation'),
    ('mvrv_z', 0.15, 0.17, None, 4.6, 6.65, 'none', 'macro_valuation'),
    ('lth_sth_sopr_ratio', 0.73, 0.99, None, 3.2, 6.9, 'none', 'macro_valuation'),
    ('terminal_price_ratio', -0.8367, -0.7242, None, -0.3230, 1.1426, 'expanding_window', 'macro_valuation'),
    ('unrealized_sell_risk', 0.7, 0.85, None, 1.8, 2.2, 'none', 'macro_valuation'),
    
    # Technical (Tactical Sentiment & Macro Technicals)
    ('sharpe_ratio_52w', -2.0, -1.0, None, 2.0, 3.0, 'none', 'tactical_sentiment'),
    ('sharpe_52w', -2.0, -1.0, None, 2.0, 3.0, 'none', 'tactical_sentiment'),
    
    ('pi_cycle_top', 0.35, 0.45, None, 0.7, 0.95, 'none', 'macro_valuation'),
    ('pi_cycle_top_ratio', 0.35, 0.45, None, 0.7, 0.95, 'none', 'macro_valuation'),
    
    ('vpli', 45.0, 50.0, None, 70.0, 80.0, 'none', 'macro_valuation'),
    ('risk_metrics', 0.13, 0.33, None, 0.75, 0.85, 'none', 'macro_valuation'),
    
    ('dvrsi', 42.0, 50.0, None, 65.0, 73.0, 'none', 'tactical_sentiment'),
    ('williams_r', -100.0, -80.0, None, -20.0, 0.0, 'none', 'tactical_sentiment'),
    
    ('two_year_ma', 0.7, 1.0, None, 3.0, 4.2, 'none', 'macro_valuation'),
    ('two_year_ma_ratio', 0.7, 1.0, None, 3.0, 4.2, 'none', 'macro_valuation'),
    ('ahr999', 0.45, 0.7, None, 2.9, 5.47, 'none', 'macro_valuation'),
    
    # Sentiment (Tactical Sentiment)
    ('fear_greed_og', 30.0, 50.0, None, 60.0, 70.0, 'none', 'tactical_sentiment'),
    ('fear_greed_cmc', 20.0, 40.0, None, 60.0, 80.0, 'none', 'tactical_sentiment'),
    
    # Cointime-Adjusted (DR-Immune) Indicators (Macro Valuation)
    ('mvrv_z_cvsc', -0.01904188, 0.01190121, None, 0.1368715, 0.4428151, 'expanding_window', 'macro_valuation'),
    ('pi_cycle_top_cvsc', 0.02022542, 0.03113206, None, 0.06272494, 0.1327491, 'expanding_window', 'macro_valuation'),
    ('risk_metrics_cvsc', -0.01509178, 0.01839362, None, 0.07947216, 0.3225641, 'expanding_window', 'macro_valuation'),
    ('two_year_ma_rcap', -0.4520, 0.0538, None, 1.3918, 15.0359, 'expanding_window', 'macro_valuation'),
    ('ahr999_cvsc', 0.004401681, 0.00750219, None, 0.02143929, 0.3693588, 'expanding_window', 'macro_valuation'),
    ('vpli_cvsc', -3.131786, -0.8605572, None, 3.830948, 43.6952, 'expanding_window', 'macro_valuation'),
    
    # Bitview-native metrics
    ('seller_exhaustion', 0.3, 0.2, None, 0.05, 0.02, 'expanding_window', 'macro_valuation'),
]

def seed_db(db_path: str = DB_PATH):
    print(f"Seeding metric configuration into database: {db_path}...")
    
    # Ensure directory exists
    db_dir = os.path.dirname(db_path)
    if db_dir and not os.path.exists(db_dir):
        try:
            os.makedirs(db_dir, exist_ok=True)
        except Exception:
            pass
        
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Create table if not exists (to be safe and standalone)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS metric_config (
            metric_name TEXT PRIMARY KEY,
            t_minus_2 REAL,
            t_minus_1 REAL,
            t_zero REAL,
            t_plus_1 REAL,
            t_plus_2 REAL,
            rescale_method TEXT DEFAULT 'none',
            category_layer TEXT DEFAULT 'macro_valuation'
        )
    ''')
    try:
        cursor.execute("ALTER TABLE metric_config ADD COLUMN rescale_method TEXT DEFAULT 'none'")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE metric_config ADD COLUMN category_layer TEXT DEFAULT 'macro_valuation'")
    except Exception:
        pass

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS cvsc_cache (
            date TEXT PRIMARY KEY,
            cvsc_value REAL,
            fetched_at TEXT
        )
    ''')
    
    # Insert or replace
    for row in SEED_DATA:
        cursor.execute('''
            INSERT OR REPLACE INTO metric_config
            (metric_name, t_plus_2, t_plus_1, t_zero, t_minus_1, t_minus_2, rescale_method, category_layer)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', row)
        
    conn.commit()
    
    # Let's count row count
    cursor.execute("SELECT COUNT(*) FROM metric_config")
    cnt = cursor.fetchone()[0]
    conn.close()
    
    print(f"Successfully seeded {cnt} metric config records.")

if __name__ == '__main__':
    seed_db()
