import pandas as pd
from quant.components.base import BaseComponent
from quant.components.bitview_client import fetch_series
from quant.components.normalization import normalize_metric, compute_cvsc_norm

class MvrvZCvscComponent(BaseComponent):
    METRIC_NAME = "mvrv_z_cvsc"
    DESCRIPTION = "MVRV Z-Score / CVSC (Cointime-Adjusted)"
    CATEGORY = "fundamental"

    def fetch_data(self, full_rebuild: bool = False) -> pd.DataFrame:
        df_mc = fetch_series("market_cap")
        df_rc = fetch_series("realized_cap")
        df_p = fetch_series("price")

        if df_mc.empty or df_rc.empty or df_p.empty:
            return pd.DataFrame()

        df = pd.merge(df_mc, df_rc, on="date", suffixes=("_mc", "_rc"))
        df = pd.merge(df, df_p, on="date")
        df = df.rename(columns={"value": "value_price"})
        df = df.dropna(subset=["value_mc", "value_rc", "value_price"])
        df = df.sort_values("date").reset_index(drop=True)
        if df.empty:
            return pd.DataFrame()

        # Compute MVRV Z-Score (standard)
        rolling_std = df["value_mc"].rolling(window=1460, min_periods=1).std()
        expanding_std = df["value_mc"].expanding(min_periods=1).std()
        std_series = rolling_std.fillna(expanding_std).fillna(1.0).replace(0.0, 1.0)
        df["mvrv_z_raw"] = (df["value_mc"] - df["value_rc"]) / std_series

        # Divide by CVSC_norm
        df["cvsc_norm"] = df["date"].apply(lambda d: compute_cvsc_norm(d))
        df["raw_value"] = df["mvrv_z_raw"] / df["cvsc_norm"]
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
