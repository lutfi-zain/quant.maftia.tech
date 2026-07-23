import pandas as pd
import numpy as np
from quant.components.base import BaseComponent
from quant.components.bitview_client import fetch_series
from quant.components.normalization import normalize_metric, compute_cvsc_norm

class TwoYearMaRcapComponent(BaseComponent):
    METRIC_NAME = "two_year_ma_rcap"
    DESCRIPTION = "Two-Year MA / CVSC (Cointime-Adjusted)"
    CATEGORY = "technical"

    def fetch_data(self, full_rebuild: bool = False) -> pd.DataFrame:
        df_price = fetch_series("price")

        if df_price.empty:
            return pd.DataFrame()

        df = df_price.rename(columns={"value": "close"}).copy()
        df = df.sort_values("date").reset_index(drop=True)

        # Compute 2-year MA of price
        df["two_year_ma"] = df["close"].rolling(window=730, min_periods=365).mean()

        # Divide by CVSC_norm (same cointime-adjustment as other DR-immune indicators)
        df["cvsc_norm"] = df["date"].apply(lambda d: compute_cvsc_norm(d))
        df["raw_value"] = df["two_year_ma"] / df["cvsc_norm"]
        df["btc_price"] = df["close"]

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
