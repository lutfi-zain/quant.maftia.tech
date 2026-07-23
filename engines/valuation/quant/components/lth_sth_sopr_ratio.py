import pandas as pd
from quant.components.base import BaseComponent
from quant.components.bitview_client import fetch_series
from quant.components.normalization import normalize_metric

class LthSthSoprRatioComponent(BaseComponent):
    METRIC_NAME = "lth_sth_sopr_ratio"
    DESCRIPTION = "[DEPRECATED] LTH/STH SOPR Ratio"
    CATEGORY = "fundamental"

    def fetch_data(self, full_rebuild: bool = False) -> pd.DataFrame:
        start_date = None if full_rebuild else self.get_latest_date()
        
        df_lth = fetch_series("lth_sopr_24h", start_date=start_date)
        df_sth = fetch_series("sth_sopr_24h", start_date=start_date)
        df_p = fetch_series("price", start_date=start_date)
        
        if df_lth.empty or df_sth.empty or df_p.empty:
            return pd.DataFrame()
            
        df = pd.merge(df_lth, df_sth, on="date", suffixes=("_lth", "_sth"))
        df = pd.merge(df, df_p, on="date")
        df = df.rename(columns={"value": "value_price"})
        
        df = df.dropna(subset=["value_lth", "value_sth", "value_price"])
        df = df[(df["value_sth"] > 0) & (df["value_price"] > 0)]
        return df

    def normalize(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.sort_values("date").reset_index(drop=True)
        df["raw_value"] = (df["value_lth"] / df["value_sth"]).rolling(window=14, min_periods=1).mean()
        df["btc_price"] = df["value_price"]
        
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
    
    parser = argparse.ArgumentParser(description=f"Run {LthSthSoprRatioComponent.METRIC_NAME} pipeline")
    parser.add_argument("--rebuild", action="store_true", help="Trigger full rebuild")
    args = parser.parse_args()
    
    comp = LthSthSoprRatioComponent()
    res = comp.run_pipeline(full_rebuild=args.rebuild)
    print(json.dumps(res, indent=2))
