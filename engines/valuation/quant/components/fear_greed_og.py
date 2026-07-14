import requests
import pandas as pd
from datetime import datetime, timezone
from quant.components.base import BaseComponent
from quant.components.bitview_client import fetch_series
from quant.components.normalization import normalize_metric

class FearGreedOgComponent(BaseComponent):
    METRIC_NAME = "fear_greed_og"
    DESCRIPTION = "Alternative.me Crypto Fear & Greed Index"
    CATEGORY = "sentiment"

    def fetch_data(self, full_rebuild: bool = False) -> pd.DataFrame:
        limit = 0 if full_rebuild else 90
        url = f"https://api.alternative.me/fng/?limit={limit}&format=json"
        
        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            res_json = response.json()
        except Exception as e:
            raise RuntimeError(f"Failed to fetch Alternative.me Fear & Greed: {str(e)}")

        items = res_json.get("data", [])
        if not items:
            return pd.DataFrame()

        rows = []
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
            except (ValueError, KeyError) as e:
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
    
    parser = argparse.ArgumentParser(description=f"Run {FearGreedOgComponent.METRIC_NAME} pipeline")
    parser.add_argument("--rebuild", action="store_true", help="Trigger full rebuild")
    args = parser.parse_args()
    
    comp = FearGreedOgComponent()
    res = comp.run_pipeline(full_rebuild=args.rebuild)
    print(json.dumps(res, indent=2))
