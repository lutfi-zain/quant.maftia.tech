import pandas as pd
from quant.components.base import BaseComponent
from quant.components.bitview_client import fetch_series
from quant.components.normalization import normalize_metric

class SellerExhaustionComponent(BaseComponent):
    METRIC_NAME = "seller_exhaustion"
    DESCRIPTION = "Seller Exhaustion Constant (bitview.space)"
    CATEGORY = "fundamental"

    def fetch_data(self, full_rebuild: bool = False) -> pd.DataFrame:
        df = fetch_series("seller_exhaustion")

        if df.empty:
            return pd.DataFrame()

        df = df.rename(columns={"value": "raw_value"}).copy()
        df = df.sort_values("date").reset_index(drop=True)
        df["btc_price"] = 0.0

        if not full_rebuild:
            start_date = self.get_latest_date()
            if start_date:
                df = df[df["date"] > start_date]

        return df

    def normalize(self, df: pd.DataFrame) -> pd.DataFrame:
        df["normalized_value"] = df.apply(
            lambda row: normalize_metric(self.db_path, self.METRIC_NAME, row["raw_value"], row["date"]),
            axis=1
        )
        return df

    def store(self, df: pd.DataFrame) -> int:
        return self._default_store(df)

    def rescale(self, df: pd.DataFrame) -> pd.DataFrame:
        from quant.components.normalization import expanding_window_rescale
        if 'normalized_value' in df.columns:
            df['normalized_value'] = expanding_window_rescale(df['normalized_value'].fillna(0))
        return df

    def run_pipeline(self, full_rebuild: bool = False) -> dict:
        return self._default_run_pipeline(full_rebuild=full_rebuild)
