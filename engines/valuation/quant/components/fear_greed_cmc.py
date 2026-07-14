import requests
import pandas as pd
import time
from datetime import datetime, timezone
from quant.components.base import BaseComponent
from quant.components.bitview_client import fetch_series
from quant.components.normalization import normalize_metric

class FearGreedCmcComponent(BaseComponent):
    METRIC_NAME = "fear_greed_cmc"
    DESCRIPTION = "CoinMarketCap Fear & Greed Index"
    CATEGORY = "sentiment"

    def fetch_data(self, full_rebuild: bool = False) -> pd.DataFrame:
        base_url = "https://pro-api.coinmarketcap.com/trial-pro-api/v3/fear-and-greed/historical"
        
        rows = []
        if full_rebuild:
            # Rebuild: Paginate through all historical data (limit=500 per page)
            start = 1
            limit = 500
            while True:
                url = f"{base_url}?limit={limit}&start={start}"
                try:
                    response = requests.get(url, timeout=30)
                    response.raise_for_status()
                    res_json = response.json()
                except Exception as e:
                    raise RuntimeError(f"Failed to fetch CMC Fear & Greed at start={start}: {str(e)}")
                
                items = res_json.get("data", [])
                if not items:
                    break
                    
                for item in items:
                    try:
                        ts = int(item["timestamp"])
                        dt = datetime.fromtimestamp(ts, tz=timezone.utc)
                        date_str = dt.strftime("%Y-%m-%dT00:00:00Z")
                        val = float(item["value"])
                        rows.append({
                            "date": date_str,
                            "raw_value": val
                        })
                    except (ValueError, KeyError):
                        continue
                
                # If we received fewer items than requested, we reached the end of history
                if len(items) < limit:
                    break
                    
                start += limit
                time.sleep(1) # Gentle rate limit spacing
        else:
            # Incremental: fetch with limit=90 to ensure complete window for SMA
            url = f"{base_url}?limit=90"
            try:
                response = requests.get(url, timeout=30)
                response.raise_for_status()
                res_json = response.json()
            except Exception as e:
                raise RuntimeError(f"Failed to fetch CMC Fear & Greed (incremental): {str(e)}")
                
            items = res_json.get("data", [])
            for item in items:
                try:
                    ts = int(item["timestamp"])
                    dt = datetime.fromtimestamp(ts, tz=timezone.utc)
                    date_str = dt.strftime("%Y-%m-%dT00:00:00Z")
                    val = float(item["value"])
                    rows.append({
                        "date": date_str,
                        "raw_value": val
                    })
                except (ValueError, KeyError):
                    continue

        df_fng = pd.DataFrame(rows)
        if df_fng.empty:
            return pd.DataFrame()

        # Sort chronologically
        df_fng = df_fng.sort_values("date").reset_index(drop=True)

        # Apply 30-day Simple Moving Average (SMA) smoothing
        df_fng["raw_value"] = df_fng["raw_value"].rolling(window=30, min_periods=1).mean()

        # Merge with BTC price from bitview.space
        try:
            start_date = None if full_rebuild else self.get_latest_date()
            df_price = fetch_series("price", start_date=start_date)
            if not df_price.empty:
                df = pd.merge(df_fng, df_price, on="date", how="left")
                df = df.rename(columns={"value": "btc_price"})
            else:
                df = df_fng
                df["btc_price"] = None
        except Exception as e:
            # Price fetch is auxiliary; don't fail the whole pipeline if it errors
            df = df_fng
            df["btc_price"] = None

        # Filter for delta if not full_rebuild
        if not full_rebuild:
            start_date = self.get_latest_date()
            if start_date:
                df = df[df["date"] > start_date]

        return df

    def normalize(self, df: pd.DataFrame) -> pd.DataFrame:
        df["normalized_value"] = df["raw_value"].apply(
            lambda val: normalize_metric(self.db_path, self.METRIC_NAME, val)
        )
        return df

    def store(self, df: pd.DataFrame) -> int:
        return self._default_store(df)

    def run_pipeline(self, full_rebuild: bool = False) -> dict:
        return self._default_run_pipeline(full_rebuild=full_rebuild)

if __name__ == "__main__":
    import argparse
    import json
    
    parser = argparse.ArgumentParser(description=f"Run {FearGreedCmcComponent.METRIC_NAME} pipeline")
    parser.add_argument("--rebuild", action="store_true", help="Trigger full rebuild")
    args = parser.parse_args()
    
    comp = FearGreedCmcComponent()
    res = comp.run_pipeline(full_rebuild=args.rebuild)
    print(json.dumps(res, indent=2))
