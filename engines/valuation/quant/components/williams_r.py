import pandas as pd
import numpy as np
from quant.components.base import BaseComponent
from quant.components.bitview_client import fetch_series
from quant.components.normalization import normalize_metric

class WilliamsRComponent(BaseComponent):
    METRIC_NAME = "williams_r"
    DESCRIPTION = "Weekly Williams %R (71-Week Lookback)"
    CATEGORY = "technical"

    def fetch_data(self, full_rebuild: bool = False) -> pd.DataFrame:
        df_ohlc = fetch_series("price_ohlc", index="week1")
        if df_ohlc.empty:
            return pd.DataFrame()
            
        df = df_ohlc.dropna(subset=["high", "low", "close"]).sort_values("date").reset_index(drop=True)
        
        if len(df) < 71:
            return pd.DataFrame()
            
        # 71-week rolling highest high and lowest low
        df["highest_high"] = df["high"].rolling(window=71).max()
        df["lowest_low"] = df["low"].rolling(window=71).min()
        
        # Williams %R = ((highest_high - close) / (highest_high - lowest_low)) * -100
        # Avoid division by zero
        denom = df["highest_high"] - df["lowest_low"]
        df["raw_value"] = np.where(
            denom > 0,
            ((df["highest_high"] - df["close"]) / denom) * -100.0,
            np.nan
        )
        df["btc_price"] = df["close"]

        # Resample to daily frequency and forward-fill to avoid daily NaN alignment drops
        df["date"] = pd.to_datetime(df["date"])
        df.set_index("date", inplace=True)
        
        # Reindex to daily range and ffill
        daily_index = pd.date_range(start=df.index.min(), end=df.index.max(), freq='D')
        df = df.reindex(daily_index).ffill()
        assert isinstance(df, pd.DataFrame)
        df.index.name = 'date'
        df.reset_index(inplace=True)
        # Format back to ISO string format to match DB layout (T-format matches bitview_client.py)
        df["date"] = df["date"].dt.strftime("%Y-%m-%dT00:00:00Z")
        
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
    
    parser = argparse.ArgumentParser(description="Run Williams %R pipeline")
    parser.add_argument("--rebuild", action="store_true", help="Trigger full rebuild")
    args = parser.parse_args()
    
    comp = WilliamsRComponent()
    res = comp.run_pipeline(full_rebuild=args.rebuild)
    print(json.dumps(res, indent=2))
