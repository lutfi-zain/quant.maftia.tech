import pandas as pd
import numpy as np
from quant.components.base import BaseComponent
from quant.components.bitview_client import fetch_series
from quant.components.normalization import normalize_metric

class VpliComponent(BaseComponent):
    METRIC_NAME = "vpli"
    DESCRIPTION = "Volatility Adjusted Power Law Index (VPLI)"
    CATEGORY = "technical"

    def fetch_data(self, full_rebuild: bool = False) -> pd.DataFrame:
        df_p = fetch_series("price")
        if df_p.empty:
            return pd.DataFrame()
            
        df = df_p.dropna(subset=["value"]).sort_values("date").reset_index(drop=True)
        df = df[df["value"] > 0]
        
        if len(df) < 365:
            return pd.DataFrame()
            
        # Parse date strings to DatetimeIndex, make tz-naive to avoid offset-aware comparison error
        dates = pd.to_datetime(df["date"], utc=True).dt.tz_localize(None)
        genesis = pd.to_datetime("2009-01-03").tz_localize(None)
        df["days"] = (dates - genesis).dt.days
        df = df[df["days"] > 0].reset_index(drop=True)
        
        if df.empty:
            return pd.DataFrame()
            
        # Linear regression in log-log space: log10(price) = slope * log10(days) + intercept
        log10_days = np.log10(df["days"])
        log10_price = np.log10(df["value"])
        slope, intercept = np.polyfit(log10_days, log10_price, 1)
        
        df["log10_fair"] = slope * log10_days + intercept
        df["residual_ln"] = np.log(df["value"]) - np.log(10 ** df["log10_fair"])
        
        # Volatility: standard deviation of daily log returns in rolling 365-day window
        df["log_return"] = np.log(df["value"] / df["value"].shift(1))
        df["daily_vol"] = df["log_return"].rolling(window=365).std()
        df["ann_vol"] = df["daily_vol"] * np.sqrt(365.0)
        
        # Raw value: VPLI = 50 + 20 * (residual_ln / ann_vol)
        df["raw_value"] = np.where(
            df["ann_vol"] > 0,
            50.0 + 20.0 * (df["residual_ln"] / df["ann_vol"]),
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
    
    parser = argparse.ArgumentParser(description="Run VPLI pipeline")
    parser.add_argument("--rebuild", action="store_true", help="Trigger full rebuild")
    args = parser.parse_args()
    
    comp = VpliComponent()
    res = comp.run_pipeline(full_rebuild=args.rebuild)
    print(json.dumps(res, indent=2))
