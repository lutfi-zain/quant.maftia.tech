import pytest
import pandas as pd
import sqlite3
import os
from unittest.mock import MagicMock
from quant.components.base import BaseComponent

class DummyComponent(BaseComponent):
    METRIC_NAME = "dummy_metric"
    DESCRIPTION = "Dummy metric for testing"
    CATEGORY = "fundamental"

    def fetch_data(self, full_rebuild: bool = False) -> pd.DataFrame:
        return pd.DataFrame([
            {"date": "2025-06-01", "raw_value": 1.0, "btc_price": 50000.0},
            {"date": "2025-06-02", "raw_value": 2.0, "btc_price": 51000.0}
        ])

    def normalize(self, df: pd.DataFrame) -> pd.DataFrame:
        df["normalized_value"] = df["raw_value"] * 0.5
        return df

    def store(self, df: pd.DataFrame) -> int:
        return self._default_store(df)

    def run_pipeline(self, full_rebuild: bool = False) -> dict:
        return self._default_run_pipeline(full_rebuild=full_rebuild)

def test_base_component_enforces_attributes():
    # Test missing METRIC_NAME
    with pytest.raises(TypeError, match="Subclass must define non-empty class attribute 'METRIC_NAME'"):
        class MissingMetricName(BaseComponent):
            DESCRIPTION = "test"
            CATEGORY = "fundamental"
            def fetch_data(self, f): pass
            def normalize(self, df): pass
            def store(self, df): pass
            def run_pipeline(self, f): pass
        MissingMetricName()

    # Test missing DESCRIPTION
    with pytest.raises(TypeError, match="Subclass must define non-empty class attribute 'DESCRIPTION'"):
        class MissingDescription(BaseComponent):
            METRIC_NAME = "test"
            CATEGORY = "fundamental"
            def fetch_data(self, f): pass
            def normalize(self, df): pass
            def store(self, df): pass
            def run_pipeline(self, f): pass
        MissingDescription()

    # Test missing/invalid CATEGORY
    with pytest.raises(TypeError, match="Subclass must define class attribute 'CATEGORY' as one of: fundamental, technical, sentiment"):
        class InvalidCategory(BaseComponent):
            METRIC_NAME = "test"
            DESCRIPTION = "test"
            CATEGORY = "invalid_category"
            def fetch_data(self, f): pass
            def normalize(self, df): pass
            def store(self, df): pass
            def run_pipeline(self, f): pass
        InvalidCategory()

def test_base_component_run_pipeline(tmp_path):
    db_file = str(tmp_path / "test_base.db")
    
    # Initialize DB
    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE timeseries_metrics (
            date TEXT,
            metric_name TEXT,
            raw_value REAL,
            normalized_value REAL,
            btc_price REAL,
            PRIMARY KEY (metric_name, date)
        )
    ''')
    conn.commit()
    conn.close()

    comp = DummyComponent(db_path=db_file)
    assert comp.get_latest_date() is None

    # Run pipeline
    res = comp.run_pipeline(full_rebuild=False)
    assert res["status"] == "success"
    assert res["rows_fetched"] == 2
    assert res["rows_stored"] == 2
    assert res["metric_name"] == "dummy_metric"

    # Verify rows stored
    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM timeseries_metrics WHERE metric_name = 'dummy_metric' ORDER BY date ASC")
    rows = cursor.fetchall()
    conn.close()

    assert len(rows) == 2
    # Date, Metric, Raw, Normalized, BTC
    assert rows[0] == ("2025-06-01", "dummy_metric", 1.0, 0.5, 50000.0)
    assert rows[1] == ("2025-06-02", "dummy_metric", 2.0, 1.0, 51000.0)

    # get_latest_date should now return 2025-06-02
    assert comp.get_latest_date() == "2025-06-02"

def test_base_component_pipeline_empty_fetch():
    class EmptyFetchComponent(DummyComponent):
        def fetch_data(self, full_rebuild: bool = False) -> pd.DataFrame:
            return pd.DataFrame()

    comp = EmptyFetchComponent()
    comp.normalize = MagicMock()
    comp.store = MagicMock()

    res = comp.run_pipeline()
    assert res["status"] == "success"
    assert res["rows_fetched"] == 0
    assert res["rows_stored"] == 0
    assert res["message"] == "No new data was available."
    comp.normalize.assert_not_called()
    comp.store.assert_not_called()

def test_base_component_pipeline_error():
    class FailComponent(DummyComponent):
        def fetch_data(self, full_rebuild: bool = False) -> pd.DataFrame:
            raise RuntimeError("API failure")

    comp = FailComponent()
    res = comp.run_pipeline()
    assert res["status"] == "error"
    assert "RuntimeError: API failure" in res["message"]
