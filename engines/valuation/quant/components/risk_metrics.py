import pandas as pd
import numpy as np
from quant.components.base import BaseComponent
from quant.components.bitview_client import fetch_series
from quant.components.normalization import normalize_metric

class RiskMetricsComponent(BaseComponent):
    METRIC_NAME = "risk_metrics"
    DESCRIPTION = "Bitcoin Risk Metric (SMA 374 + time decay)"
    CATEGORY = "technical"

    def fetch_data(self, full_rebuild: bool = False) -> pd.DataFrame:
        df_p = fetch_series("price")
        if df_p.empty:
            return pd.DataFrame()
            
        df = df_p.dropna(subset=["value"]).sort_values("date").reset_index(drop=True)
        df = df[df["value"] > 0]
        
        if len(df) < 374:
            return pd.DataFrame()
            
        # Compute SMA(374)
        df["sma374"] = df["value"].rolling(window=374).mean()
        
        # log deviation: ln(price) - ln(sma374)
        df["log_dev"] = np.log(df["value"]) - np.log(df["sma374"])
        
        # bar_index starting from 1
        df["bar_index"] = np.arange(len(df)) + 1
        
        # raw_temp = log_dev * (bar_index ** 0.395)
        df["raw_temp"] = df["log_dev"] * (df["bar_index"] ** 0.395)
        
        # Min-max scale raw_temp over the full history to [0.0, 1.0]
        # Guard against zero range
        min_val = df["raw_temp"].min()
        max_val = df["raw_temp"].max()
        val_range = max_val - min_val
        
        if abs(val_range) > 1e-9:
            df["raw_value"] = (df["raw_temp"] - min_val) / val_range
        else:
            df["raw_value"] = np.where(df["raw_temp"].notna(), 0.5, np.nan)
            
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
    
    parser = argparse.ArgumentParser(description="Run Risk Metrics pipeline")
    parser.add_argument("--rebuild", action="store_true", help="Trigger full rebuild")
    args = parser.parse_args()
    
    comp = RiskMetricsComponent()
    res = comp.run_pipeline(full_rebuild=args.rebuild)
    print(json.dumps(res, indent=2))
