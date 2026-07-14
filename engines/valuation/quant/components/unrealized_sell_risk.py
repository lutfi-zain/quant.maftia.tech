import pandas as pd
from quant.components.base import BaseComponent
from quant.components.bitview_client import fetch_series
from quant.components.normalization import normalize_metric

class UnrealizedSellRiskComponent(BaseComponent):
    METRIC_NAME = "unrealized_sell_risk"
    DESCRIPTION = "Unrealized Sell-Side Risk Ratio"
    CATEGORY = "fundamental"

    def fetch_data(self, full_rebuild: bool = False) -> pd.DataFrame:
        start_date = None if full_rebuild else self.get_latest_date()
        
        df_up = fetch_series("unrealized_profit", start_date=start_date)
        df_ul = fetch_series("unrealized_loss", start_date=start_date)
        df_rc = fetch_series("realized_cap", start_date=start_date)
        df_p = fetch_series("price", start_date=start_date)
        
        if df_up.empty or df_ul.empty or df_rc.empty or df_p.empty:
            return pd.DataFrame()
            
        df = pd.merge(df_up, df_ul, on="date", suffixes=("_up", "_ul"))
        df = pd.merge(df, df_rc, on="date")
        df = df.rename(columns={"value": "value_rc"})
        df = pd.merge(df, df_p, on="date")
        df = df.rename(columns={"value": "value_price"})
        
        df = df.dropna(subset=["value_up", "value_ul", "value_rc", "value_price"])
        df = df[(df["value_rc"] > 0) & (df["value_price"] > 0)]
        return df

    def normalize(self, df: pd.DataFrame) -> pd.DataFrame:
        df["raw_value"] = (df["value_up"] + df["value_ul"]) / df["value_rc"]
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
    
    parser = argparse.ArgumentParser(description=f"Run {UnrealizedSellRiskComponent.METRIC_NAME} pipeline")
    parser.add_argument("--rebuild", action="store_true", help="Trigger full rebuild")
    args = parser.parse_args()
    
    comp = UnrealizedSellRiskComponent()
    res = comp.run_pipeline(full_rebuild=args.rebuild)
    print(json.dumps(res, indent=2))
