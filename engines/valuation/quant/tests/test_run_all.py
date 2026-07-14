import pytest
import sqlite3
from unittest.mock import patch, MagicMock
from quant.run_all import run_all, print_summary
from quant.components.base import BaseComponent

class MockSuccessComponent(BaseComponent):
    METRIC_NAME = "mock_success"
    DESCRIPTION = "Mock Success Component"
    CATEGORY = "technical"
    
    def fetch_data(self, full_rebuild: bool = False):
        import pandas as pd
        return pd.DataFrame([{"date": "2026-06-01T00:00:00Z", "value": 1.0}])
        
    def normalize(self, df):
        df["normalized_value"] = 1.5
        df["raw_value"] = df["value"]
        df["btc_price"] = 100000.0
        return df
        
    def store(self, df):
        return len(df)
        
    def run_pipeline(self, full_rebuild: bool = False):
        return {
            "metric_name": self.METRIC_NAME,
            "rows_fetched": 1,
            "rows_stored": 1,
            "status": "success",
            "message": "Mock success"
        }

class MockFailureComponent(BaseComponent):
    METRIC_NAME = "mock_failure"
    DESCRIPTION = "Mock Failure Component"
    CATEGORY = "technical"
    
    def fetch_data(self, full_rebuild: bool = False):
        raise ValueError("Mock fetch error")
        
    def normalize(self, df):
        return df
        
    def store(self, df):
        return 0
        
    def run_pipeline(self, full_rebuild: bool = False):
        raise ValueError("Mock pipeline error")

@patch('quant.run_all.discover_components')
def test_run_all_isolates_failures(mock_discover, tmp_path):
    db_file = str(tmp_path / "test_run_all.db")
    
    # Mock discover_components to return our mock classes
    mock_discover.return_value = [MockFailureComponent, MockSuccessComponent]
    
    results = run_all(db_path=db_file, rebuild=True)
    
    assert len(results) == 2
    
    # First component should fail, but its error is caught and isolated
    assert results[0]["metric_name"] == "mock_failure"
    assert results[0]["status"] == "error"
    assert "Exception" in results[0]["message"]
    
    # Second component should still run and succeed
    assert results[1]["metric_name"] == "mock_success"
    assert results[1]["status"] == "success"
    assert results[1]["rows_stored"] == 1
    
    # Print summary should run without errors
    print_summary(results)
