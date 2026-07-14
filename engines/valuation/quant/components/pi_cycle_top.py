import pandas as pd
import numpy as np
from quant.components.base import BaseComponent
from quant.components.bitview_client import fetch_series
from quant.components.normalization import normalize_metric

class PiCycleTopComponent(BaseComponent):
    METRIC_NAME = "pi_cycle_top"
    DESCRIPTION = "Pi Cycle Top Indicator"
    CATEGORY = "technical"

    def fetch_data(self, full_rebuild: bool = False) -> pd.DataFrame:
        df_p = fetch_series("price")
        if df_p.empty:
            return pd.DataFrame()
            
        df = df_p.dropna(subset=["value"]).sort_values("date").reset_index(drop=True)
        df = df[df["value"] > 0]
        
        if len(df) < 350:
            return pd.DataFrame()
            
        # Compute SMA(111) and SMA(350)
        df["sma111"] = df["value"].rolling(window=111).mean()
        df["sma350"] = df["value"].rolling(window=350).mean()
        
        # Compute ratio = SMA(111) / (SMA(350) * 2)
        # Guard against zero in SMA(350)
        df["raw_value"] = np.where(
            df["sma350"] > 0,
            df["sma111"] / (df["sma350"] * 2.0),
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
    
    parser = argparse.ArgumentParser(description=f"Run {PiCycleTopComponent.METRIC_NAME} pipeline")
    parser.add_argument("--rebuild", action="store_true", help="Trigger full rebuild")
    args = parser.parse_args()
    
    comp = PiCycleTopComponent()
    res = comp.run_pipeline(full_rebuild=args.rebuild)
    print(json.dumps(res, indent=2))
