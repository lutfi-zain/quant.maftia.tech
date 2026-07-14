import requests
from datetime import datetime, timedelta

def fetch_ohlc():
    url = "https://bitview.space/api/series/price_ohlc_cents/day1/data"
    resp = requests.get(url)
    data = resp.json()
    
    start_date = datetime(2009, 1, 3)
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
        
    print(f"Fetched {len(results)} days of OHLC data.")
    print("Latest:", results[-1])
    return results

if __name__ == "__main__":
    fetch_ohlc()
