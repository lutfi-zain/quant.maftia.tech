import requests
from datetime import datetime, timedelta
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
from database.db import init_db, insert_ohlc, insert_ohlc_batch, get_latest_ohlc_date

def fetch_bitview_ohlc():
    """
    Fetch OHLC data from bitview.space API and insert into DB.
    """
    url = "https://bitview.space/api/series/price_ohlc_cents/day1/data"
    print(f"Fetching OHLC data from {url}...")
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    
    start_date = datetime(2009, 1, 1)
    results = []
    
    for i, row in enumerate(data):
        if len(row) != 4:
            continue
        o, h, l, c = row
        # Skip days with 0 data (early days)
        if c == 0:
            continue
            
        current_date = start_date + timedelta(days=i)
        
        # Convert cents to dollars
        results.append({
            "date": current_date.strftime("%Y-%m-%dT00:00:00Z"),
            "open": o / 100.0,
            "high": h / 100.0,
            "low": l / 100.0,
            "close": c / 100.0
        })
    
    return results

def run_pipeline(db_path: str = "database/metrics.db", full_rebuild: bool = False):
    init_db(db_path=db_path)
    data = fetch_bitview_ohlc()
    
    latest_date = None
    if not full_rebuild:
        latest_date = get_latest_ohlc_date(db_path=db_path)
        
    if latest_date:
        # Filter for newer rows
        data = [row for row in data if row['date'] > latest_date]
        
    inserted = insert_ohlc_batch(data, db_path=db_path)
    print(f"BTC OHLC pipeline executed successfully. Inserted {inserted} rows (rebuild={full_rebuild}).")
    return inserted

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Run BTC OHLC ingestion pipeline")
    parser.add_argument("--rebuild", action="store_true", help="Trigger a full historical rebuild")
    parser.add_argument("--db-path", default="database/metrics.db", help="Path to SQLite database file")
    args = parser.parse_args()
    
    run_pipeline(db_path=args.db_path, full_rebuild=args.rebuild)

