import sqlite3
import os

DB_PATH = 'database/metrics.db'

# Threshold configurations for all metrics.
# Format: (metric_name, t_plus_2, t_plus_1, t_zero, t_minus_1, t_minus_2)
# We seed both the component names and any alternative spec names to ensure maximum compatibility.
SEED_DATA = [
    # Fundamental
    ('aviv_ratio', -2.0, -1.0, None, 1.0, 2.0),
    ('aviv_ratio_z', -2.0, -1.0, None, 1.0, 2.0),
    
    ('aviv_nupl', -0.6, -0.3, None, 0.3, 0.5),
    
    ('cvdd_ratio', 1.0, 2.0, None, 15.0, 25.0),
    
    ('mvrv_z', 0.15, 0.17, None, 4.6, 6.65),
    
    ('lth_sth_sopr_ratio', 0.73, 0.99, None, 3.2, 6.9),
    
    ('terminal_price_ratio', 1.0, 0.75, None, 0.25, 0.17),
    
    ('unrealized_sell_risk', 0.7, 0.85, None, 1.8, 2.2),
    
    # Technical
    ('sharpe_ratio_52w', -2.0, -1.0, None, 2.0, 3.0),
    ('sharpe_52w', -2.0, -1.0, None, 2.0, 3.0),
    
    ('pi_cycle_top', 0.35, 0.45, None, 0.7, 0.95),
    ('pi_cycle_top_ratio', 0.35, 0.45, None, 0.7, 0.95),
    
    ('vpli', 45.0, 50.0, None, 70.0, 80.0),
    
    ('risk_metrics', 0.13, 0.33, None, 0.75, 0.85),
    
    ('dvrsi', 42.0, 50.0, None, 65.0, 73.0),
    
    ('williams_r', -100.0, -80.0, None, -20.0, 0.0),
    
    ('two_year_ma', 0.7, 1.0, None, 3.0, 4.2),
    ('two_year_ma_ratio', 0.7, 1.0, None, 3.0, 4.2),
    
    ('ahr999', 0.45, 0.7, None, 2.9, 5.47),
    
    # Sentiment
    ('fear_greed_og', 30.0, 50.0, None, 60.0, 70.0),
    
    ('fear_greed_cmc', 20.0, 40.0, None, 60.0, 80.0)
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
            t_plus_2 REAL
        )
    ''')
    
    # Insert or ignore
    for row in SEED_DATA:
        cursor.execute('''
            INSERT OR IGNORE INTO metric_config
            (metric_name, t_plus_2, t_plus_1, t_zero, t_minus_1, t_minus_2)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', row)
        
    conn.commit()
    
    # Let's count row count
    cursor.execute("SELECT COUNT(*) FROM metric_config")
    cnt = cursor.fetchone()[0]
    conn.close()
    
    print(f"Successfully seeded {cnt} metric config records.")

if __name__ == '__main__':
    seed_db()
