import sqlite3
import os

DB_PATH = 'database/metrics.db'

# Threshold configurations for all metrics.
# Format: (metric_name, t_plus_2, t_plus_1, t_zero, t_minus_1, t_minus_2, rescale_method)
# We seed both the component names and any alternative spec names to ensure maximum compatibility.
SEED_DATA = [
    # Fundamental
    ('aviv_ratio', -2.0, -1.0, None, 1.0, 2.0, 'expanding_window'),
    ('aviv_ratio_z', -2.0, -1.0, None, 1.0, 2.0, 'expanding_window'),
    
    ('aviv_nupl', -0.6, -0.3, None, 0.3, 0.5, 'none'),
    
    ('cvdd_ratio', 1.0, 2.0, None, 15.0, 25.0, 'none'),
    
    ('mvrv_z', 0.15, 0.17, None, 4.6, 6.65, 'none'),
    
    ('lth_sth_sopr_ratio', 0.73, 0.99, None, 3.2, 6.9, 'none'),
    
    ('terminal_price_ratio', 1.0, 0.75, None, 0.25, 0.17, 'none'),
    
    ('unrealized_sell_risk', 0.7, 0.85, None, 1.8, 2.2, 'none'),
    
    # Technical
    ('sharpe_ratio_52w', -2.0, -1.0, None, 2.0, 3.0, 'none'),
    ('sharpe_52w', -2.0, -1.0, None, 2.0, 3.0, 'none'),
    
    ('pi_cycle_top', 0.35, 0.45, None, 0.7, 0.95, 'none'),
    ('pi_cycle_top_ratio', 0.35, 0.45, None, 0.7, 0.95, 'none'),
    
    ('vpli', 45.0, 50.0, None, 70.0, 80.0, 'none'),
    
    ('risk_metrics', 0.13, 0.33, None, 0.75, 0.85, 'none'),
    
    ('dvrsi', 42.0, 50.0, None, 65.0, 73.0, 'none'),
    
    ('williams_r', -100.0, -80.0, None, -20.0, 0.0, 'none'),
    
    ('two_year_ma', 0.7, 1.0, None, 3.0, 4.2, 'none'),
    ('two_year_ma_ratio', 0.7, 1.0, None, 3.0, 4.2, 'none'),
    
    ('ahr999', 0.45, 0.7, None, 2.9, 5.47, 'none'),
    
    # Sentiment
    ('fear_greed_og', 30.0, 50.0, None, 60.0, 70.0, 'none'),
    
    ('fear_greed_cmc', 20.0, 40.0, None, 60.0, 80.0, 'none'),
    
    # Cointime-Adjusted (DR-Immune) Indicators
    ('mvrv_z_cvsc', 0.15, 0.08, None, -0.03, -0.06, 'expanding_window'),
    ('pi_cycle_top_cvsc', 0.0025, 0.0015, None, -0.0008, -0.0015, 'expanding_window'),
    ('risk_metrics_cvsc', 6.5e-16, 3.0e-16, None, -1.5e-16, -3.0e-16, 'expanding_window'),
    ('two_year_ma_rcap', 3.5, 2.5, None, 0.8, 0.5, 'expanding_window'),
    ('ahr999_cvsc', 1.2e-15, 6.0e-16, None, -3.0e-16, -5.0e-16, 'expanding_window'),
    ('vpli_cvsc', 2.0e-14, 1.0e-14, None, -5.0e-15, -1.0e-14, 'expanding_window'),
    
    # Bitview-native metrics
    ('seller_exhaustion', 0.3, 0.2, None, 0.05, 0.02, 'expanding_window'),
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
            rescale_method TEXT DEFAULT 'none'
        )
    ''')
    
    # Insert or ignore
    for row in SEED_DATA:
        cursor.execute('''
            INSERT OR IGNORE INTO metric_config
            (metric_name, t_plus_2, t_plus_1, t_zero, t_minus_1, t_minus_2, rescale_method)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', row)
        
    conn.commit()
    
    # Let's count row count
    cursor.execute("SELECT COUNT(*) FROM metric_config")
    cnt = cursor.fetchone()[0]
    conn.close()
    
    print(f"Successfully seeded {cnt} metric config records.")

if __name__ == '__main__':
    seed_db()
