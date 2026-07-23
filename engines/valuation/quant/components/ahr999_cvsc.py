import pandas as pd
import numpy as np
from quant.components.base import BaseComponent
from quant.components.bitview_client import fetch_series
from quant.components.normalization import normalize_metric, compute_cvsc_norm

class Ahr999CvscComponent(BaseComponent):
    METRIC_NAME = "ahr999_cvsc"
    DESCRIPTION = "AHR999 / CVSC (Cointime-Adjusted)"
    CATEGORY = "technical"

    def fetch_data(self, full_rebuild: bool = False) -> pd.DataFrame:
        df_price = fetch_series("price")
        df_mc = fetch_series("market_cap")

        if df_price.empty or df_mc.empty:
            return pd.DataFrame()

        df = pd.merge(df_price, df_mc, on="date", suffixes=("_price", "_mc"))
        df = df.dropna(subset=["value_price", "value_mc"])
        df = df.sort_values("date").reset_index(drop=True)
        if df.empty:
            return pd.DataFrame()

        # AHR999 = price / (200-day MA * 4-year average growth)
        df["ma_200"] = df["value_price"].rolling(window=200, min_periods=200).mean()
        df["ma_200"] = df["ma_200"].ffill()

        # 4-year average growth rate (estimated from market cap)
        df["mc_growth_4y"] = df["value_mc"].pct_change(periods=1460).fillna(0.1) + 1.0
        df["mc_growth_4y"] = df["mc_growth_4y"].clip(1.0, 10.0)

        # AHR999 = price / (200-day MA * growth factor)
        df["ahr999_raw"] = df["value_price"] / (df["ma_200"] * df["mc_growth_4y"])
        df["ahr999_raw"] = df["ahr999_raw"].replace([np.inf, -np.inf], float("nan"))

        # Divide by CVSC_norm
        df["cvsc_norm"] = df["date"].apply(lambda d: compute_cvsc_norm(d))
        df["raw_value"] = df["ahr999_raw"] / df["cvsc_norm"]
        df["btc_price"] = df["value_price"]

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
