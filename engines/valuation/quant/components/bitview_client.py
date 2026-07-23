import requests
import pandas as pd
import time
import logging
from datetime import datetime, timedelta
from dateutil import parser as date_parser

logger = logging.getLogger(__name__)

class BitviewClientError(Exception):
    """Custom exception class for Bitview API client errors."""
    pass

_cvsc_cache: dict[str, float] | None = None

def fetch_cvsc() -> pd.DataFrame:
    """
    Fetches the Cointime Value Stored Cumulative (CVSC) series from bitview.space.
    CVSC is the total cumulative cointime value stored in the Bitcoin network,
    used as a network-scaling denominator for DR-immune indicators.
    """
    import logging
    logger = logging.getLogger(__name__)
    try:
        logger.info("Fetching CVSC series from bitview.space...")
        return fetch_series("cointime_value_stored_cumulative")
    except Exception as e:
        logger.error(f"Failed to fetch CVSC: {e}")
        return pd.DataFrame()


def fetch_series(series_name: str, index: str = "day1", start_date: str | None = None) -> pd.DataFrame:
    """
    Fetches time-series data from bitview.space API and returns a pandas DataFrame.
    
    Parameters:
    - series_name: Name of the series (e.g. 'cointime_price', 'price')
    - index: Timeframe index (default 'day1', can also be 'week1')
    - start_date: Optional ISO8601 date string to filter results
    """
    url = f"https://bitview.space/api/series/{series_name}/{index}/data"
    
    max_retries = 3
    timeout = 30
    
    # Simple retry loop with exponential backoff
    for attempt in range(max_retries + 1):
        try:
            logger.info(f"Fetching series '{series_name}' (index: '{index}') from {url}...")
            response = requests.get(url, timeout=timeout)
            
            # Handle status codes
            if response.status_code == 200:
                data = response.json()
                break
            elif response.status_code == 429:
                # Rate limit handling: respect Retry-After or default 60s
                retry_after = response.headers.get("Retry-After")
                wait_time = int(retry_after) if retry_after and retry_after.isdigit() else 60
                logger.warning(f"Rate limited (429) fetching {series_name}. Retrying in {wait_time} seconds...")
                time.sleep(wait_time)
            elif 500 <= response.status_code < 600:
                if attempt < max_retries:
                    backoff = 2 ** attempt
                    logger.warning(f"Transient error {response.status_code} fetching {series_name}. Retrying in {backoff}s...")
                    time.sleep(backoff)
                else:
                    raise BitviewClientError(f"HTTP {response.status_code}: {response.text}")
            else:
                # Client error (4xx) - raise immediately
                raise BitviewClientError(f"HTTP {response.status_code}: {response.text}")
                
        except requests.exceptions.Timeout as e:
            if attempt < max_retries:
                backoff = 2 ** attempt
                logger.warning(f"Timeout fetching {series_name}. Retrying in {backoff}s...")
                time.sleep(backoff)
            else:
                raise BitviewClientError(f"Network timeout: {str(e)}")
        except requests.exceptions.RequestException as e:
            if attempt < max_retries:
                backoff = 2 ** attempt
                logger.warning(f"Request error fetching {series_name}. Retrying in {backoff}s...")
                time.sleep(backoff)
            else:
                raise BitviewClientError(f"Request failed: {str(e)}")
    else:
        raise BitviewClientError("Max retries exceeded")

    if not isinstance(data, list):
        raise BitviewClientError(f"Expected JSON list response, got {type(data)}")

    # Parse dates starting from Jan 1, 2009 for daily data, or Jan 3, 2009 for weekly data
    start_dt = datetime(2009, 1, 3) if index == "week1" else datetime(2009, 1, 1)
    delta = timedelta(weeks=1) if index == "week1" else timedelta(days=1)
    
    parsed_start = date_parser.parse(start_date).replace(tzinfo=None) if start_date else None
    
    rows = []
    for i, item in enumerate(data):
        current_date = start_dt + (i * delta)
        
        if parsed_start and current_date < parsed_start:
            continue
            
        date_str = current_date.strftime("%Y-%m-%dT00:00:00Z")
        
        if isinstance(item, list):
            # OHLC or multi-value series
            if len(item) == 4:
                o, h, l, c = item
                rows.append({
                    "date": date_str,
                    "open": float(o) if o is not None else None,
                    "high": float(h) if h is not None else None,
                    "low": float(l) if l is not None else None,
                    "close": float(c) if c is not None else None,
                    "value": float(c) if c is not None else None # default value to close
                })
        else:
            # Single value series
            val = float(item) if item is not None else None
            rows.append({
                "date": date_str,
                "value": val
            })
            
    df = pd.DataFrame(rows)
    if df.empty:
        df = pd.DataFrame(columns=["date", "value"])
        
    logger.info(f"Successfully fetched {len(df)} rows for series '{series_name}'. Date range: {df['date'].min() if not df.empty else 'N/A'} to {df['date'].max() if not df.empty else 'N/A'}")
    return df

def search_series(query: str) -> list[dict]:
    """
    Searches for matching series names on bitview.space.
    """
    url = "https://bitview.space/api/series/search"
    try:
        response = requests.get(url, params={"q": query}, timeout=30)
        if response.status_code == 200:
            names = response.json()
            if isinstance(names, list):
                return [{"name": name, "description": ""} for name in names]
        return []
    except Exception as e:
        logger.error(f"Error searching series with query '{query}': {str(e)}")
        return []
