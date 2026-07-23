from abc import ABC, abstractmethod
import pandas as pd
import sqlite3
import numpy as np
import logging

logger = logging.getLogger(__name__)

class BaseComponent(ABC):
    METRIC_NAME: str
    DESCRIPTION: str
    CATEGORY: str

    def __init__(self, db_path: str = "database/metrics.db"):
        self.db_path = db_path
        # Enforce class-level attributes
        if not hasattr(self, 'METRIC_NAME') or not self.METRIC_NAME:
            raise TypeError("Subclass must define non-empty class attribute 'METRIC_NAME'")
        if not hasattr(self, 'DESCRIPTION') or not self.DESCRIPTION:
            raise TypeError("Subclass must define non-empty class attribute 'DESCRIPTION'")
        if not hasattr(self, 'CATEGORY') or self.CATEGORY not in ("fundamental", "technical", "sentiment"):
            raise TypeError("Subclass must define class attribute 'CATEGORY' as one of: fundamental, technical, sentiment")

    @abstractmethod
    def fetch_data(self, full_rebuild: bool = False) -> pd.DataFrame:
        """
        Fetches raw metric data from the upstream source.
        When full_rebuild is True, it fetches the entire historical dataset.
        When False, it fetches only data newer than the latest stored date.
        """
        pass

    @abstractmethod
    def normalize(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Applies the normalization formula to map raw metric values to the -2 to +2 valuation scale.
        """
        pass

    @abstractmethod
    def store(self, df: pd.DataFrame) -> int:
        """
        Persists the processed DataFrame into the timeseries_metrics table and returns the number of rows upserted.
        """
        pass

    @abstractmethod
    def run_pipeline(self, full_rebuild: bool = False) -> dict:
        """
        Orchestrates fetch -> normalize -> store in sequence and returns a summary dict.
        """
        pass

    def get_latest_date(self) -> str | None:
        """
        Queries the timeseries_metrics table for the most recent date for this metric.
        Returns None if no data exists.
        """
        import sys
        if "/home/ubuntu/projects" not in sys.path:
            sys.path.insert(0, "/home/ubuntu/projects")
        from db_connector import get_wal_connection
        conn = get_wal_connection(self.db_path)
        cursor = conn.cursor()
        try:
            cursor.execute('''
                SELECT MAX(date) FROM timeseries_metrics 
                WHERE metric_name = ?
            ''', (self.METRIC_NAME,))
            row = cursor.fetchone()
            if row and row[0]:
                return str(row[0])
            return None
        except sqlite3.OperationalError:
            # Table might not exist yet
            return None
        finally:
            conn.close()

    def _default_store(self, df: pd.DataFrame) -> int:
        """
        Helper method providing default store implementation.
        """
        if df is None or df.empty:
            return 0

        # Filter out rows where raw_value is NULL or NaN
        df_clean = df.dropna(subset=['raw_value'])
        if df_clean.empty:
            return 0

        import sys
        if "/home/ubuntu/projects" not in sys.path:
            sys.path.insert(0, "/home/ubuntu/projects")
        from db_connector import get_wal_connection
        conn = get_wal_connection(self.db_path)
        cursor = conn.cursor()
        try:
            rows_to_insert = []
            for _, row in df_clean.iterrows():
                raw_val = float(row['raw_value'])
                
                norm_val = row.get('normalized_value')
                if pd.isna(norm_val) or norm_val is None:
                    norm_val = None
                else:
                    norm_val = float(norm_val)

                btc_pr = row.get('btc_price')
                if pd.isna(btc_pr) or btc_pr is None:
                    btc_pr = None
                else:
                    btc_pr = float(btc_pr)

                rows_to_insert.append((
                    str(row['date']),
                    str(self.METRIC_NAME),
                    raw_val,
                    norm_val,
                    btc_pr
                ))

            cursor.executemany('''
                INSERT OR REPLACE INTO timeseries_metrics 
                (date, metric_name, raw_value, normalized_value, btc_price)
                VALUES (?, ?, ?, ?, ?)
            ''', rows_to_insert)
            conn.commit()
            return len(rows_to_insert)
        finally:
            conn.close()

    def rescale(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Optional rescaling step applied after normalize and before store.
        Override this in subclasses to apply expanding-window percentile rescaling.
        Default is no-op.
        """
        return df

    def _default_run_pipeline(self, full_rebuild: bool = False) -> dict:
        """
        Helper method providing default run_pipeline implementation.
        Pipeline: fetch_data -> normalize -> rescale -> store
        """
        try:
            df = self.fetch_data(full_rebuild=full_rebuild)
            rows_fetched = len(df) if df is not None else 0

            if df is None or df.empty:
                return {
                    "metric_name": self.METRIC_NAME,
                    "rows_fetched": 0,
                    "rows_stored": 0,
                    "status": "success",
                    "message": "No new data was available."
                }

            df_norm = self.normalize(df)
            df_rescaled = self.rescale(df_norm)
            rows_stored = self.store(df_rescaled)

            return {
                "metric_name": self.METRIC_NAME,
                "rows_fetched": rows_fetched,
                "rows_stored": rows_stored,
                "status": "success",
                "message": f"Successfully processed and stored {rows_stored} rows."
            }
        except Exception as e:
            logger.error(f"Error running pipeline for {self.METRIC_NAME}: {type(e).__name__}: {str(e)}")
            return {
                "metric_name": self.METRIC_NAME,
                "rows_fetched": 0,
                "rows_stored": 0,
                "status": "error",
                "message": f"{type(e).__name__}: {str(e)}"
            }
