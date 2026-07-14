import datetime
import yfinance as yf
import pandas as pd
import os
import requests

def fetch_binance_btc_data(start_date: str = '2018-01-01') -> pd.DataFrame:
    """
    Fallback method to fetch daily BTC-USDT klines from Binance API when Yahoo Finance is rate limited.
    """
    print(f"Falling back to Binance API to fetch BTC-USDT data starting {start_date}...")
    start_ts = int(pd.to_datetime(start_date).timestamp() * 1000)
    end_ts = int(datetime.datetime.now().timestamp() * 1000)
    
    all_klines = []
    current_ts = start_ts
    while current_ts < end_ts:
        url = f"https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=1000&startTime={current_ts}"
        try:
            response = requests.get(url, timeout=10)
            if response.status_code != 200:
                print(f"Binance API returned status code {response.status_code}")
                break
            data = response.json()
            if not data:
                break
            all_klines.extend(data)
            last_close_time = data[-1][6]
            current_ts = last_close_time + 1
            if len(data) < 1000:
                break
        except Exception as e:
            print(f"Exception during Binance API request: {e}")
            break
            
    if not all_klines:
        raise ValueError("Failed to fetch klines from Binance API: response was empty or error occurred.")
        
    df = pd.DataFrame(all_klines)
    df = df[[0, 1, 2, 3, 4]]
    df.columns = ['time', 'Open', 'High', 'Low', 'Close']
    df['time'] = pd.to_datetime(df['time'], unit='ms')
    
    for col in ['Open', 'High', 'Low', 'Close']:
        df[col] = pd.to_numeric(df[col], errors='coerce')
        
    df.set_index('time', inplace=True)
    return df

def fetch_btc_data(start_date: str = '2018-01-01') -> pd.DataFrame:
    """
    Fetches daily OHLC price data for BTC-USD from Yahoo Finance.
    Falls back to Binance API if Yahoo Finance is rate limited or unavailable.
    Caches the data to tmp/btc_cache.csv to prevent API rate limits.
    """
    cache_file = "tmp/btc_cache.csv"
    
    # We clear cache if start_date changes or to get latest data
    # (Yahoo Finance provides up-to-date data dynamically)
    if os.path.exists(cache_file):
        # To ensure we get the latest data up to today, we can check the file modification date
        # or simply load the cached data. Let's load the cache.
        df = pd.read_csv(cache_file, index_col='time', parse_dates=True)
        return df

    df = pd.DataFrame()
    try:
        print(f"Fetching BTC-USD data from yfinance starting {start_date}...")
        df = yf.download("BTC-USD", start=start_date, progress=False)
        
        # Flatten multi-index if returned by yfinance
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
            
        df = df.reset_index()
        # yfinance columns might be lowercase or capitalised. Let's rename Date.
        date_col = None
        for col in ['Date', 'date', 'Date ', 'time']:
            if col in df.columns:
                date_col = col
                break
        
        if date_col:
            df.rename(columns={date_col: 'time'}, inplace=True)
            df.set_index('time', inplace=True)
        else:
            raise KeyError("Date column not found in yfinance output.")
            
        df = df[["Open", "High", "Low", "Close"]].copy()
        # Check if we got data
        if df.empty or len(df) < 10:
            raise ValueError("yfinance returned empty or insufficient data.")
            
    except Exception as e:
        print(f"yfinance download failed: {e}")
        try:
            df = fetch_binance_btc_data(start_date)
        except Exception as fallback_err:
            raise RuntimeError(f"Both yfinance and Binance fallback failed. yfinance error: {e}. Binance error: {fallback_err}")
    
    # Clean data
    df = df[(df["Open"] > 0) & (df["High"] > 0) & (df["Low"] > 0) & (df["Close"] > 0)].dropna()
    
    # Save cache
    os.makedirs(os.path.dirname(cache_file), exist_ok=True)
    df.to_csv(cache_file)
    
    return df
