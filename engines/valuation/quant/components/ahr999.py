import pandas as pd
import numpy as np
from quant.components.base import BaseComponent
from quant.components.bitview_client import fetch_series
from quant.components.normalization import normalize_metric

class Ahr999Component(BaseComponent):
    METRIC_NAME = "ahr999"
    DESCRIPTION = "Bitcoin Ahr999 Index"
    CATEGORY = "technical"

    def fetch_data(self, full_rebuild: bool = False) -> pd.DataFrame:
        df_p = fetch_series("price")
        if df_p.empty:
            return pd.DataFrame()
            
        df = df_p.dropna(subset=["value"]).sort_values("date").reset_index(drop=True)
        df = df[df["value"] > 0]
        
        if len(df) < 200:
            return pd.DataFrame()
            
        # Parse date strings to DatetimeIndex, make tz-naive
        dates = pd.to_datetime(df["date"], utc=True).dt.tz_localize(None)
        genesis = pd.to_datetime("2009-01-03").tz_localize(None)
        df["days"] = (dates - genesis).dt.days
        df = df[df["days"] > 0].reset_index(drop=True)
        
        if df.empty:
            return pd.DataFrame()
            
        # Linear regression: log10(price) = slope * log10(days) + intercept
        log10_days = np.log10(df["days"])
        log10_price = np.log10(df["value"])
        slope, intercept = np.polyfit(log10_days, log10_price, 1)
        
        # growth_valuation
        df["growth_val"] = 10 ** (slope * log10_days + intercept)
        
        # Compute 200-day moving average (DCA cost)
        df["sma200"] = df["value"].rolling(window=200).mean()
        
        # ahr999 = sqrt((price / sma200) * (price / growth_val))
        df["ratio_dca"] = df["value"] / df["sma200"]
        df["ratio_growth"] = df["value"] / df["growth_val"]
        
        # Avoid zero or negative values in root
        df["raw_value"] = np.where(
            (df["sma200"] > 0) & (df["growth_val"] > 0) & (df["ratio_dca"] * df["ratio_growth"] > 0),
            np.sqrt(df["ratio_dca"] * df["ratio_growth"]),
            np.nan
        )
        df["btc_price"] = df["value"]
        
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
    
    parser = argparse.ArgumentParser(description="Run Ahr999 pipeline")
    parser.add_argument("--rebuild", action="store_true", help="Trigger full rebuild")
    args = parser.parse_args()
    
    comp = Ahr999Component()
    res = comp.run_pipeline(full_rebuild=args.rebuild)
    print(json.dumps(res, indent=2))
