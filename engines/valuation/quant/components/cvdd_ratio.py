import pandas as pd
from quant.components.base import BaseComponent
from quant.components.bitview_client import fetch_series
from quant.components.normalization import normalize_metric

class CvddRatioComponent(BaseComponent):
    METRIC_NAME = "cvdd_ratio"
    DESCRIPTION = "CVDD Ratio"
    CATEGORY = "fundamental"

    def fetch_data(self, full_rebuild: bool = False) -> pd.DataFrame:
        # Fetch full history to compute cumulative sum correctly
        df_cdd = fetch_series("coindays_destroyed_sum_24h")
        df_p = fetch_series("price")
        
        if df_cdd.empty or df_p.empty:
            return pd.DataFrame()
            
        df = pd.merge(df_cdd, df_p, on="date", suffixes=("_cdd", "_p"))
        df = df.dropna(subset=["value_cdd", "value_p"])
        df = df.sort_values("date").reset_index(drop=True)
        
        if df.empty:
            return pd.DataFrame()
            
        # Compute CVDD = cumsum(CDD * price) / (age_in_days * 6,000,000)
        df["cdd_price"] = df["value_cdd"] * df["value_p"]
        df["cum_cdd_price"] = df["cdd_price"].cumsum()
        df["age_in_days"] = range(1, len(df) + 1)
        df["cvdd"] = df["cum_cdd_price"] / (df["age_in_days"] * 6000000.0)
        
        # Raw value = price / CVDD
        # Guard against division by zero
        df["raw_value"] = df.apply(
            lambda row: row["value_p"] / row["cvdd"] if row["cvdd"] > 0 else 0.0, axis=1
        )
        df["btc_price"] = df["value_p"]
        
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
    
    parser = argparse.ArgumentParser(description=f"Run {CvddRatioComponent.METRIC_NAME} pipeline")
    parser.add_argument("--rebuild", action="store_true", help="Trigger full rebuild")
    args = parser.parse_args()
    
    comp = CvddRatioComponent()
    res = comp.run_pipeline(full_rebuild=args.rebuild)
    print(json.dumps(res, indent=2))
