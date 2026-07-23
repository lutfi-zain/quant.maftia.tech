import pandas as pd
from quant.components.base import BaseComponent
from quant.components.normalization import normalize_metric, compute_cvsc_norm

class RiskMetricsCvscComponent(BaseComponent):
    METRIC_NAME = "risk_metrics_cvsc"
    DESCRIPTION = "Risk Metrics / CVSC (Cointime-Adjusted)"
    CATEGORY = "technical"

    def fetch_data(self, full_rebuild: bool = False) -> pd.DataFrame:
        from quant.components.bitview_client import fetch_series
        df_mc = fetch_series("market_cap")
        df_rc = fetch_series("realized_cap")

        if df_mc.empty or df_rc.empty:
            return pd.DataFrame()

        df = pd.merge(df_mc, df_rc, on="date", suffixes=("_mc", "_rc"))
        df = df.dropna(subset=["value_mc", "value_rc"])
        df = df.sort_values("date").reset_index(drop=True)
        if df.empty:
            return pd.DataFrame()

        # Risk Metrics: (MC - RC) / RC = MVRV - 1 (simple version)
        df["risk_raw"] = (df["value_mc"] - df["value_rc"]) / df["value_rc"].replace(0, float("nan"))

        # Divide by CVSC_norm
        df["cvsc_norm"] = df["date"].apply(lambda d: compute_cvsc_norm(d))
        df["raw_value"] = df["risk_raw"] / df["cvsc_norm"]
        df["btc_price"] = float("nan")

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
