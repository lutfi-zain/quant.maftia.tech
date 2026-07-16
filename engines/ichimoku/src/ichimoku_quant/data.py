import datetime
import pandas as pd
import requests


def fetch_btc_ohlcv_from_bitview(start_date: str = '2009-01-01') -> pd.DataFrame:
    """
    Fetches daily BTC OHLCV data from bitview.space using the price_ohlc_cents/day1 series.

    Returns a DataFrame with columns Open, High, Low, Close (in USD) indexed by UTC date.
    Zero-close rows (early Bitcoin genesis period with no market price) are skipped.
    Data is anchored at 2009-01-01 + index offset as per the bitview.space series convention.
    """
    url = "https://bitview.space/api/series/price_ohlc_cents/day1/data"
    print(f"Fetching BTC OHLCV data from bitview.space ({url})...")

    response = requests.get(url, timeout=30)
    response.raise_for_status()
    data = response.json()

    if not data or not isinstance(data, list):
        raise ValueError("bitview.space returned empty or invalid response for price_ohlc_cents/day1.")

    anchor_date = datetime.date(2009, 1, 1)
    rows = []

    for i, row in enumerate(data):
        if len(row) != 4:
            continue
        o, h, l, c = row
        # Skip days with 0 price (early Bitcoin genesis period)
        if c == 0:
            continue
        current_date = anchor_date + datetime.timedelta(days=i)
        rows.append({
            'time': pd.Timestamp(current_date, tz='UTC'),
            'Open': o / 100.0,
            'High': h / 100.0,
            'Low': l / 100.0,
            'Close': c / 100.0,
        })

    if not rows:
        raise ValueError("bitview.space price_ohlc_cents/day1 returned no usable price rows.")

    df = pd.DataFrame(rows)
    df.set_index('time', inplace=True)

    # Apply start_date filter
    start_ts = pd.Timestamp(start_date, tz='UTC')
    df = df[df.index >= start_ts]

    # Ensure positive values only
    df = df[(df['Open'] > 0) & (df['High'] > 0) & (df['Low'] > 0) & (df['Close'] > 0)]

    return df
