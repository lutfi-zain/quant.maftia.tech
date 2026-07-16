from abc import ABC, abstractmethod
import pandas as pd
from datetime import datetime
import requests
import logging

logger = logging.getLogger(__name__)


class ExchangeAdapter(ABC):
    @abstractmethod
    def fetch_ohlcv(
        self, start_time: datetime = None, end_time: datetime = None
    ) -> pd.DataFrame:
        pass


class BRKExchangeAdapter(ExchangeAdapter):
    def fetch_ohlcv(
        self, start_time: datetime = None, end_time: datetime = None
    ) -> pd.DataFrame:
        from brk_client import BrkClient
        from datetime import timezone
        import numpy as np

        client = BrkClient(base_url="https://bitview.space")
        metrics = ["price_open", "price_high", "price_low", "price"]
        data = {}
        
        # We need a common start_idx and end_idx
        # Fetch price first as the anchor
        res_price = client.get_series("price", index="day1")
        start_idx = res_price["start"]
        end_idx = res_price["end"] - 1
        
        data["price"] = pd.Series(res_price["data"])
        
        for m in ["price_open", "price_high", "price_low"]:
            res = client.get_series(m, index="day1")
            data[m] = pd.Series(res["data"])

        idx_range = range(start_idx, end_idx + 1)
        dates = [pd.Timestamp("2009-01-01", tz="UTC") + pd.Timedelta(days=i) for i in idx_range]

        df = pd.DataFrame({
            "open": data["price_open"].values,
            "high": data["price_high"].values,
            "low": data["price_low"].values,
            "close": data["price"].values,
            "volume": 0.0
        }, index=pd.DatetimeIndex([datetime(d.year, d.month, d.day, tzinfo=timezone.utc) for d in dates]))

        # Filter 0s and NaNs which are present in early 2009-2010 for price columns
        price_cols = ["open", "high", "low", "close"]
        df[price_cols] = df[price_cols].replace(0, np.nan)
        df = df.dropna(subset=price_cols)

        if start_time:
            df = df[df.index >= start_time]
        if end_time:
            df = df[df.index <= end_time]

        return df

