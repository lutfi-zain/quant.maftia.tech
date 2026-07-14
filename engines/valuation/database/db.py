import sqlite3
import os
from typing import List, Dict, Any, Optional

_current_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.dirname(_current_dir)
DB_PATH = os.path.join(_project_root, 'database', 'metrics.db')

def get_connection(db_path: str = DB_PATH) -> sqlite3.Connection:
    import sys
    if "/home/ubuntu/projects" not in sys.path:
        sys.path.insert(0, "/home/ubuntu/projects")
    from db_connector import get_wal_connection
    conn = get_wal_connection(db_path)
    conn.row_factory = sqlite3.Row
    return conn

def init_db(db_path: str = DB_PATH) -> None:
    """Initialize the database schema and indices."""
    conn = get_connection(db_path)
    cursor = conn.cursor()
    
    # Create the timeseries_metrics table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS timeseries_metrics (
            date TEXT,
            metric_name TEXT,
            raw_value REAL,
            normalized_value REAL,
            btc_price REAL,
            PRIMARY KEY (metric_name, date)
        )
    ''')
    
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_metric_date 
        ON timeseries_metrics (metric_name, date)
    ''')
    
    # Create the btc_ohlc table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS btc_ohlc (
            date TEXT PRIMARY KEY,
            open REAL,
            high REAL,
            low REAL,
            close REAL
        )
    ''')
    
    # Create the metric_config table
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

    # Create the audit_indicator_stats table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS audit_indicator_stats (
            metric_name TEXT NOT NULL,
            run_date TEXT NOT NULL,
            count INTEGER,
            mean REAL,
            std REAL,
            skewness REAL,
            kurtosis REAL,
            p2_5 REAL,
            p5 REAL,
            p25 REAL,
            p50 REAL,
            p75 REAL,
            p95 REAL,
            p97_5 REAL,
            min_val REAL,
            max_val REAL,
            pct_at_plus2 REAL,
            pct_at_minus2 REAL,
            PRIMARY KEY (metric_name, run_date)
        )
    ''')

    # Create the audit_correlation_matrix table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS audit_correlation_matrix (
            metric_a TEXT NOT NULL,
            metric_b TEXT NOT NULL,
            run_date TEXT NOT NULL,
            pearson REAL,
            spearman REAL,
            PRIMARY KEY (metric_a, metric_b, run_date)
        )
    ''')

    # Create the audit_composite_params table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS audit_composite_params (
            run_date TEXT NOT NULL PRIMARY KEY,
            raw_min REAL,
            raw_max REAL,
            raw_p2_5 REAL,
            raw_p50 REAL,
            raw_p97_5 REAL,
            rescale_method TEXT DEFAULT 'percentile_piecewise'
        )
    ''')
    
    conn.commit()
    conn.close()

def insert_metric(
    date: str, 
    metric_name: str, 
    raw_value: float, 
    normalized_value: float, 
    btc_price: float,
    db_path: str = DB_PATH
) -> None:
    """Insert or replace a metric record."""
    conn = get_connection(db_path)
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT OR REPLACE INTO timeseries_metrics 
        (date, metric_name, raw_value, normalized_value, btc_price)
        VALUES (?, ?, ?, ?, ?)
    ''', (date, metric_name, raw_value, normalized_value, btc_price))
    
    conn.commit()
    conn.close()

def insert_ohlc(
    date: str, 
    open_price: float, 
    high: float, 
    low: float, 
    close: float,
    db_path: str = DB_PATH
) -> None:
    """Insert or replace an OHLC record."""
    conn = get_connection(db_path)
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT OR REPLACE INTO btc_ohlc 
        (date, open, high, low, close)
        VALUES (?, ?, ?, ?, ?)
    ''', (date, open_price, high, low, close))
    
    conn.commit()
    conn.close()

def insert_ohlc_batch(
    rows: List[Dict[str, Any]],
    db_path: str = DB_PATH
) -> int:
    """Insert or replace multiple OHLC records in a single transaction."""
    if not rows:
        return 0
    conn = get_connection(db_path)
    cursor = conn.cursor()
    try:
        data = [
            (row['date'], row['open'], row['high'], row['low'], row['close'])
            for row in rows
        ]
        cursor.executemany('''
            INSERT OR REPLACE INTO btc_ohlc 
            (date, open, high, low, close)
            VALUES (?, ?, ?, ?, ?)
        ''', data)
        conn.commit()
        return len(rows)
    finally:
        conn.close()

def get_latest_ohlc_date(db_path: str = DB_PATH) -> Optional[str]:
    """Get the latest date in the btc_ohlc table."""
    conn = get_connection(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT MAX(date) FROM btc_ohlc")
        row = cursor.fetchone()
        if row and row[0]:
            return str(row[0])
        return None
    except sqlite3.OperationalError:
        return None
    finally:
        conn.close()


def get_metrics(metric_name: str, db_path: str = DB_PATH) -> List[Dict[str, Any]]:
    """Retrieve all records for a specific metric."""
    conn = get_connection(db_path)
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT date, raw_value, normalized_value, btc_price 
        FROM timeseries_metrics 
        WHERE metric_name = ?
        ORDER BY date ASC
    ''', (metric_name,))
    
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]

def get_ohlc(db_path: str = DB_PATH) -> List[Dict[str, Any]]:
    """Retrieve all OHLC records."""
    conn = get_connection(db_path)
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT date, open, high, low, close 
        FROM btc_ohlc 
        ORDER BY date ASC
    ''')
    
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]
