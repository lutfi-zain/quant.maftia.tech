import pytest
import requests
import pandas as pd
from unittest.mock import patch, MagicMock
from quant.components.bitview_client import fetch_series, search_series, BitviewClientError

@patch('requests.get')
def test_fetch_series_success(mock_get):
    # Mocking successful API response for a single value series
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = [10.0, 12.0, 14.5]
    mock_get.return_value = mock_resp

    # Fetch daily series
    df = fetch_series("test_series", index="day1")
    
    assert len(df) == 3
    assert list(df.columns) == ["date", "value"]
    # Verify starting date is 2009-01-01
    assert df.loc[0, "date"] == "2009-01-01T00:00:00Z"
    assert df.loc[1, "date"] == "2009-01-02T00:00:00Z"
    assert df.loc[2, "date"] == "2009-01-03T00:00:00Z"
    assert df.loc[0, "value"] == 10.0
    assert df.loc[2, "value"] == 14.5

@patch('requests.get')
def test_fetch_series_weekly(mock_get):
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = [100.0, 105.0]
    mock_get.return_value = mock_resp

    # Fetch weekly series
    df = fetch_series("test_series", index="week1")
    assert len(df) == 2
    assert df.loc[0, "date"] == "2009-01-03T00:00:00Z"
    # Verification of weekly delta (7 days)
    assert df.loc[1, "date"] == "2009-01-10T00:00:00Z"

@patch('requests.get')
def test_fetch_series_ohlc(mock_get):
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = [[10, 12, 9, 11], [11, 15, 11, 14]]
    mock_get.return_value = mock_resp

    df = fetch_series("price_ohlc_cents", index="day1")
    assert len(df) == 2
    assert "open" in df.columns
    assert "high" in df.columns
    assert "low" in df.columns
    assert "close" in df.columns
    assert df.loc[0, "open"] == 10.0
    assert df.loc[0, "close"] == 11.0
    assert df.loc[0, "value"] == 11.0

@patch('requests.get')
def test_fetch_series_with_start_date(mock_get):
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = [10.0, 11.0, 12.0]
    mock_get.return_value = mock_resp

    # Filter with start_date corresponding to the second day (2009-01-02)
    df = fetch_series("test_series", index="day1", start_date="2009-01-02")
    assert len(df) == 2
    assert df.loc[0, "date"] == "2009-01-02T00:00:00Z"
    assert df.loc[0, "value"] == 11.0

@patch('requests.get')
@patch('time.sleep', return_value=None) # mock sleep to speed up tests
def test_fetch_series_transient_retry(mock_sleep, mock_get):
    # 2 transient errors then success
    resp_500 = MagicMock()
    resp_500.status_code = 500
    resp_500.text = "Server Error"
    
    resp_200 = MagicMock()
    resp_200.status_code = 200
    resp_200.json.return_value = [1.0]

    mock_get.side_effect = [resp_500, resp_500, resp_200]

    df = fetch_series("test_series")
    assert len(df) == 1
    assert mock_get.call_count == 3

@patch('requests.get')
def test_fetch_series_client_error(mock_get):
    resp_404 = MagicMock()
    resp_404.status_code = 404
    resp_404.text = "Not Found"
    mock_get.return_value = resp_404

    with pytest.raises(BitviewClientError, match="HTTP 404"):
        fetch_series("nonexistent_series")

@patch('requests.get')
def test_search_series(mock_get):
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = ["cointime_price", "cointime_cap"]
    mock_get.return_value = mock_resp

    res = search_series("cointime")
    assert res == [
        {"name": "cointime_price", "description": ""},
        {"name": "cointime_cap", "description": ""}
    ]
