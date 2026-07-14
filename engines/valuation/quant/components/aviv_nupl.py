import pandas as pd
from quant.components.base import BaseComponent
from quant.components.checkonchain_client import fetch_plotly_chart, CheckonchainClientError
from quant.components.normalization import normalize_metric

class AvivNuplComponent(BaseComponent):
    """
    AVIV (Active-Value-to-Investor-Value) Net Unrealized Profit/Loss (NUPL) Component.

    AVIV NUPL is scraped directly from checkonchain.com reference charts.
    """
    METRIC_NAME = "aviv_nupl"
    DESCRIPTION = "AVIV NUPL"
    CATEGORY = "fundamental"

    def fetch_data(self, full_rebuild: bool = False) -> pd.DataFrame:
        url = "https://charts.checkonchain.com/btconchain/cointime/nupl_aviv/nupl_aviv_light.html"
        chart_data = fetch_plotly_chart(url)
        
        df_price = chart_data.get("Price")
        df_nupl = chart_data.get("AVIV NUPL")
        
        if df_price is None or df_price.empty or df_nupl is None or df_nupl.empty:
            return pd.DataFrame()
            
        # Merge price and AVIV NUPL
        df = pd.merge(df_price, df_nupl, on="date", suffixes=("_p", "_nupl"))
        
        df = df.dropna(subset=["value_p", "value_nupl"])
        df = df.sort_values("date").reset_index(drop=True)
        
        if df.empty:
            return pd.DataFrame()
            
        df["raw_value"] = df["value_nupl"]
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
    
    parser = argparse.ArgumentParser(description=f"Run {AvivNuplComponent.METRIC_NAME} pipeline")
    parser.add_argument("--rebuild", action="store_true", help="Trigger full rebuild")
    args = parser.parse_args()
    
    comp = AvivNuplComponent()
    res = comp.run_pipeline(full_rebuild=args.rebuild)
    print(json.dumps(res, indent=2))
