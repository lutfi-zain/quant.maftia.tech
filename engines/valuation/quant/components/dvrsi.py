import pandas as pd
import numpy as np
from quant.components.base import BaseComponent
from quant.components.bitview_client import fetch_series
from quant.components.normalization import normalize_metric


class DvrsiComponent(BaseComponent):
    METRIC_NAME = "dvrsi"
    DESCRIPTION = "Dynamic Volume RSI (DVRSI) with Daily RSI Fallback"
    CATEGORY = "technical"

    def fetch_data(self, full_rebuild: bool = False) -> pd.DataFrame:
        # Fetch price on weekly timeframe
        df_p = fetch_series("price", index="week1")
        # Fetch weekly transfer volume sum
        df_v = fetch_series("transfer_volume_sum_1w", index="week1")

        if df_p.empty or df_v.empty:
            return pd.DataFrame()

        # Sort and merge by date
        df_p = df_p.sort_values("date").reset_index(drop=True)
        df_v = df_v.sort_values("date").reset_index(drop=True)

        df = pd.merge(df_p, df_v, on="date", suffixes=("_price", "_volume"))
        df = df.dropna(subset=["value_price", "value_volume"]).reset_index(drop=True)

        if len(df) < 14:
            return pd.DataFrame()

        # price_change
        price_change = df["value_price"].diff()

        # smoothed_volume = EMA(volume, 50)
        smoothed_volume = df["value_volume"].ewm(span=50, adjust=False).mean()

        # up_raw and down_raw
        up_raw = np.where(price_change > 0, price_change * smoothed_volume, 0.0)
        down_raw = np.where(price_change < 0, np.abs(price_change) * smoothed_volume, 0.0)

        # Wilder's RMA of length 14 (EMA with alpha = 1 / 14)
        up = pd.Series(up_raw).ewm(alpha=1.0/14.0, adjust=False).mean()
        down = pd.Series(down_raw).ewm(alpha=1.0/14.0, adjust=False).mean()

        # RSI: 100 - 100 / (1 + up / down)
        rsi = np.where(down > 0, 100.0 - (100.0 / (1.0 + up / down)), 100.0)

        # NoiseReducer (EMA of length 14 of RSI)
        df["raw_value"] = pd.Series(rsi).ewm(span=14, adjust=False).mean()
        df["btc_price"] = df["value_price"]

        # --- Daily RSI Fallback Imputation ---
        # Resample to daily and fill NaN gaps with simple daily RSI(14)
        df["date"] = pd.to_datetime(df["date"])
        df.set_index("date", inplace=True)
        daily_idx = pd.date_range(start=df.index.min(), end=df.index.max(), freq='D')
        df = df.reindex(daily_idx)

        try:
            df_daily_price = fetch_series("price", index="day1")
            if not df_daily_price.empty:
                df_daily = df_daily_price.dropna(subset=["value"]).sort_values("date")
                df_daily["date"] = pd.to_datetime(df_daily["date"])
                df_daily.set_index("date", inplace=True)

                daily_close = df_daily["value"].reindex(daily_idx)
                delta = daily_close.diff()
                gain = delta.clip(lower=0).rolling(window=14).mean()
                loss = (-delta.clip(upper=0)).rolling(window=14).mean()
                safe_loss = loss.where(loss > 1e-9, other=np.nan)
                rs = gain / safe_loss
                daily_rsi = 100 - (100 / (1 + rs))

                # Fill NaN raw_value and btc_price with daily equivalents
                nan_mask = df["raw_value"].isna()
                df.loc[nan_mask, "raw_value"] = daily_rsi.loc[nan_mask]
                df.loc[nan_mask, "btc_price"] = daily_close.loc[nan_mask]
        except Exception:
            pass  # Fallback silently if daily fetch fails

        df.index.name = 'date'
        df.reset_index(inplace=True)
        df["date"] = df["date"].dt.strftime("%Y-%m-%dT00:00:00Z")

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

    parser = argparse.ArgumentParser(description="Run DVRSI pipeline")
    parser.add_argument("--rebuild", action="store_true", help="Trigger full rebuild")
    args = parser.parse_args()

    comp = DvrsiComponent()
    res = comp.run_pipeline(full_rebuild=args.rebuild)
    print(json.dumps(res, indent=2))
