import pandas as pd
import numpy as np
from quant.components.base import BaseComponent
from quant.components.bitview_client import fetch_series
from quant.components.normalization import normalize_metric

class SharpeRatio52wComponent(BaseComponent):
    METRIC_NAME = "sharpe_ratio_52w"
    DESCRIPTION = "[DEPRECATED] Rolling 52-Week Sharpe Ratio"
    CATEGORY = "technical"

    def fetch_data(self, full_rebuild: bool = False) -> pd.DataFrame:
        # Fetch full history to compute rolling metrics correctly
        df_p = fetch_series("price")
        if df_p.empty:
            return pd.DataFrame()
            
        df = df_p.dropna(subset=["value"]).sort_values("date").reset_index(drop=True)
        df = df[df["value"] > 0]
        
        if len(df) < 365:
            return pd.DataFrame()
            
        # Compute daily log returns: ln(P_t / P_{t-1})
        df["log_return"] = np.log(df["value"] / df["value"].shift(1))
        
        # Rolling 365-day mean and std dev
        rolling_mean = df["log_return"].rolling(window=365).mean()
        rolling_std = df["log_return"].rolling(window=365).std()
        
        # Sharpe = (mean / std) * sqrt(365)
        # Guard against zero standard deviation
        df["raw_value"] = np.where(
            rolling_std > 0,
            (rolling_mean / rolling_std) * np.sqrt(365.0),
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
    
    parser = argparse.ArgumentParser(description=f"Run {SharpeRatio52wComponent.METRIC_NAME} pipeline")
    parser.add_argument("--rebuild", action="store_true", help="Trigger full rebuild")
    args = parser.parse_args()
    
    comp = SharpeRatio52wComponent()
    res = comp.run_pipeline(full_rebuild=args.rebuild)
    print(json.dumps(res, indent=2))
