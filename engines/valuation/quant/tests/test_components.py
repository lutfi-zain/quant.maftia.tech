import pytest
import pandas as pd
import sqlite3
import math
from unittest.mock import patch, MagicMock
from quant.components.aviv_ratio import AvivRatioComponent
from quant.components.aviv_nupl import AvivNuplComponent
from quant.components.cvdd_ratio import CvddRatioComponent
from quant.components.mvrv_z import MvrvZComponent
from quant.components.lth_sth_sopr_ratio import LthSthSoprRatioComponent
from quant.components.terminal_price_ratio import TerminalPriceRatioComponent
from quant.components.unrealized_sell_risk import UnrealizedSellRiskComponent
from quant.components.sharpe_ratio_52w import SharpeRatio52wComponent
from quant.components.pi_cycle_top import PiCycleTopComponent
from quant.components.vpli import VpliComponent
from quant.components.risk_metrics import RiskMetricsComponent
from quant.components.dvrsi import DvrsiComponent
from quant.components.williams_r import WilliamsRComponent
from quant.components.two_year_ma import TwoYearMaComponent
from quant.components.ahr999 import Ahr999Component
from quant.components.fear_greed_og import FearGreedOgComponent
from quant.components.fear_greed_cmc import FearGreedCmcComponent

# Setup temporary DB for components testing
@pytest.fixture
def test_db(tmp_path):
    db_file = str(tmp_path / "test_metrics.db")
    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS metric_config (
            metric_name TEXT PRIMARY KEY,
            t_minus_2 REAL, t_minus_1 REAL, t_zero REAL, t_plus_1 REAL, t_plus_2 REAL
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS timeseries_metrics (
            date TEXT, metric_name TEXT, raw_value REAL, normalized_value REAL, btc_price REAL,
            PRIMARY KEY (metric_name, date)
        )
    ''')
    # Seed thresholds for the components
    seed_data = [
        ('aviv_ratio', -2.0, -1.0, None, 1.0, 2.0),
        ('aviv_nupl', -0.6, -0.3, None, 0.3, 0.5),
        ('cvdd_ratio', 1.3, 1.6, None, None, None),
        ('mvrv_z', 0.15, 0.17, None, 4.6, 6.65),
        ('lth_sth_sopr_ratio', 0.73, 0.99, None, 3.2, 6.9),
        ('terminal_price_ratio', 1.0, 0.75, None, 0.25, 0.17),
        ('unrealized_sell_risk', None, None, None, 1.8, 2.2),
        ('sharpe_ratio_52w', -20.0, -10.0, None, 42.0, 53.0),
        ('pi_cycle_top', 0.35, 0.45, None, 0.7, 0.95),
        ('vpli', 80.0, 70.0, None, 50.0, 45.0),
        ('risk_metrics', 0.85, 0.75, None, 0.33, 0.13),
        ('dvrsi', 42.0, 50.0, None, 65.0, 73.0),
        ('williams_r', -80.0, -70.0, None, None, None),
        ('two_year_ma', 0.7, 1.0, None, 3.0, 4.2),
        ('ahr999', 0.45, 0.7, None, 2.9, 5.47),
        ('fear_greed_og', 30.0, 50.0, None, 60.0, 70.0),
        ('fear_greed_cmc', 20.0, 40.0, None, 60.0, 80.0)
    ]
    for row in seed_data:
        cursor.execute('''
            INSERT INTO metric_config (metric_name, t_plus_2, t_plus_1, t_zero, t_minus_1, t_minus_2)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', row)
    conn.commit()
    conn.close()
    return db_file

@patch('quant.components.aviv_ratio.fetch_plotly_chart')
def test_aviv_ratio_component(mock_fetch, test_db):
    comp = AvivRatioComponent(db_path=test_db)
    
    mock_fetch.return_value = {
        "Price": pd.DataFrame([
            {"date": "2025-06-01T00:00:00Z", "value": 20000.0},
            {"date": "2025-06-02T00:00:00Z", "value": 40000.0},
            {"date": "2025-06-03T00:00:00Z", "value": 60000.0}
        ]),
        "AVIV Z-Score": pd.DataFrame([
            {"date": "2025-06-01T00:00:00Z", "value": -1.0},
            {"date": "2025-06-02T00:00:00Z", "value": 0.0},
            {"date": "2025-06-03T00:00:00Z", "value": 1.0}
        ])
    }
    
    res = comp.run_pipeline(full_rebuild=True)
    assert res["status"] == "success"
    assert res["rows_stored"] == 3
    
    conn = sqlite3.connect(test_db)
    rows = conn.execute("SELECT date, raw_value, normalized_value FROM timeseries_metrics WHERE metric_name = 'aviv_ratio' ORDER BY date ASC").fetchall()
    conn.close()
    
    # Verify row 0: Z-score = -1.0 -> maps to t_plus_1 (-1.0) -> yielding 1.0
    assert rows[0][1] == pytest.approx(-1.0)
    assert rows[0][2] == pytest.approx(1.0)
    
    # Verify row 2: Z-Score = 1.0 -> maps to t_minus_1 (1.0) -> yielding -1.0
    assert rows[2][1] == pytest.approx(1.0)
    assert rows[2][2] == pytest.approx(-1.0)

@patch('quant.components.aviv_nupl.fetch_plotly_chart')
def test_aviv_nupl_component(mock_fetch, test_db):
    comp = AvivNuplComponent(db_path=test_db)
    
    mock_fetch.return_value = {
        "Price": pd.DataFrame([{"date": "2025-06-01T00:00:00Z", "value": 40000.0}]),
        "AVIV NUPL": pd.DataFrame([{"date": "2025-06-01T00:00:00Z", "value": 0.2}])
    }
    
    res = comp.run_pipeline(full_rebuild=True)
    assert res["status"] == "success"
    assert res["rows_stored"] == 1
    
    # Verify values in DB: raw_value should be 0.2
    conn = sqlite3.connect(test_db)
    row = conn.execute("SELECT raw_value, normalized_value FROM timeseries_metrics WHERE metric_name = 'aviv_nupl'").fetchone()
    conn.close()
    
    assert row[0] == pytest.approx(0.2)
    # Thresholds: -0.6, -0.3, 0.3, 0.5. raw=0.2 is in neutral zone: between -0.3 and 0.3.
    # Midpoint of [-0.3, 0.3] maps to 0.0. For 0.2:
    # 1.0 - 2.0 * (0.2 - (-0.3)) / (0.3 - (-0.3)) = 1.0 - 2.0 * 0.5/0.6 = 1.0 - 1.666 = -0.666
    assert row[1] == pytest.approx(-0.66666666666)

@patch('quant.components.cvdd_ratio.fetch_series')
def test_cvdd_ratio_component(mock_fetch, test_db):
    comp = CvddRatioComponent(db_path=test_db)
    
    mock_fetch.side_effect = [
        pd.DataFrame([{"date": "2025-06-01", "value": 6000000.0}]), # coindays_destroyed
        pd.DataFrame([{"date": "2025-06-01", "value": 40000.0}])    # price
    ]
    
    res = comp.run_pipeline(full_rebuild=True)
    assert res["status"] == "success"
    assert res["rows_stored"] == 1
    
    # CVDD = (6000000 * 40000) / (1 * 6000000) = 40000.0
    # raw_value = price / CVDD = 40000 / 40000 = 1.0
    conn = sqlite3.connect(test_db)
    row = conn.execute("SELECT raw_value, normalized_value FROM timeseries_metrics WHERE metric_name = 'cvdd_ratio'").fetchone()
    conn.close()
    
    assert row[0] == pytest.approx(1.0)
    # Bottom-only thresholds: t_plus_2=1.3, t_plus_1=1.6. raw=1.0 is below 1.3, clamped to 2.0
    assert row[1] == pytest.approx(2.0)

@patch('quant.components.mvrv_z.fetch_series')
def test_mvrv_z_component(mock_fetch, test_db):
    comp = MvrvZComponent(db_path=test_db)
    
    # Setup multiple rows to compute standard deviation of market cap
    # mc_values = [10000, 20000, 30000]
    # mean_mc = 20000. StdDev(mc) = 10000.0
    mock_fetch.side_effect = [
        pd.DataFrame([
            {"date": "2025-06-01", "value": 10000.0},
            {"date": "2025-06-02", "value": 20000.0},
            {"date": "2025-06-03", "value": 30000.0}
        ]), # market_cap
        pd.DataFrame([
            {"date": "2025-06-01", "value": 8500.0},
            {"date": "2025-06-02", "value": 18300.0},
            {"date": "2025-06-03", "value": 15400.0}
        ]), # realized_cap
        pd.DataFrame([
            {"date": "2025-06-01", "value": 40000.0},
            {"date": "2025-06-02", "value": 41000.0},
            {"date": "2025-06-03", "value": 42000.0}
        ])  # price
    ]
    
    res = comp.run_pipeline(full_rebuild=True)
    assert res["status"] == "success"
    assert res["rows_stored"] == 3
    
    # std values:
    # row 0: expanding std of [10000] is NaN -> replaced by 1.0. raw = (10000 - 8500)/1 = 1500.0
    # row 1: expanding std of [10000, 20000] is ~7071.07. raw = (20000 - 18300)/7071.07 = 0.2404
    # row 2: expanding std of [10000, 20000, 30000] is 10000.0. raw = (30000 - 15400)/10000 = 1.46
    conn = sqlite3.connect(test_db)
    rows = conn.execute("SELECT date, raw_value, normalized_value FROM timeseries_metrics WHERE metric_name = 'mvrv_z' ORDER BY date ASC").fetchall()
    conn.close()
    
    assert len(rows) == 3
    assert rows[0][1] == pytest.approx(1500.0) # raw
    assert rows[1][1] == pytest.approx(0.2404163) # raw
    assert rows[2][1] == pytest.approx(1.46) # raw

@patch('quant.components.lth_sth_sopr_ratio.fetch_series')
def test_lth_sth_sopr_ratio_component(mock_fetch, test_db):
    comp = LthSthSoprRatioComponent(db_path=test_db)
    
    mock_fetch.side_effect = [
        pd.DataFrame([{"date": "2025-06-01", "value": 1.2}]), # lth_sopr
        pd.DataFrame([{"date": "2025-06-01", "value": 1.0}]), # sth_sopr
        pd.DataFrame([{"date": "2025-06-01", "value": 40000.0}]) # price
    ]
    
    res = comp.run_pipeline(full_rebuild=True)
    assert res["status"] == "success"
    assert res["rows_stored"] == 1
    
    # raw_value = 1.2 / 1.0 = 1.2
    conn = sqlite3.connect(test_db)
    row = conn.execute("SELECT raw_value, normalized_value FROM timeseries_metrics WHERE metric_name = 'lth_sth_sopr_ratio'").fetchone()
    conn.close()
    
    assert row[0] == pytest.approx(1.2)

@patch('quant.components.terminal_price_ratio.fetch_series')
def test_terminal_price_ratio_component(mock_fetch, test_db):
    comp = TerminalPriceRatioComponent(db_path=test_db)
    
    mock_fetch.side_effect = [
        pd.DataFrame([{"date": "2025-06-01", "value": 6000000.0}]), # coindays_destroyed
        pd.DataFrame([{"date": "2025-06-01", "value": 40000.0}]),   # price
        pd.DataFrame([{"date": "2025-06-01", "value": 19000000.0}]) # supply
    ]
    
    res = comp.run_pipeline(full_rebuild=True)
    assert res["status"] == "success"
    assert res["rows_stored"] == 1
    
    # transferred_price = (6000000 * 40000) / (1 * 19000000) = 240000 / 19 = 12631.5789
    # terminal_price = transferred_price * 21 = 265263.15789
    # raw_value = price / terminal_price = 40000 / 265263.15789 = 0.15079
    conn = sqlite3.connect(test_db)
    row = conn.execute("SELECT raw_value, normalized_value FROM timeseries_metrics WHERE metric_name = 'terminal_price_ratio'").fetchone()
    conn.close()
    
    assert row[0] == pytest.approx(40000.0 / ( ( (6000000.0 * 40000.0) / 19000000.0 ) * 21.0 ))

@patch('quant.components.unrealized_sell_risk.fetch_series')
def test_unrealized_sell_risk_component(mock_fetch, test_db):
    comp = UnrealizedSellRiskComponent(db_path=test_db)
    
    mock_fetch.side_effect = [
        pd.DataFrame([{"date": "2025-06-01", "value": 80000.0}]),  # unrealized_profit
        pd.DataFrame([{"date": "2025-06-01", "value": 20000.0}]),  # unrealized_loss
        pd.DataFrame([{"date": "2025-06-01", "value": 50000.0}]),  # realized_cap
        pd.DataFrame([{"date": "2025-06-01", "value": 40000.0}])   # price
    ]
    
    res = comp.run_pipeline(full_rebuild=True)
    assert res["status"] == "success"
    assert res["rows_stored"] == 1
    
    # raw_value = (80000 + 20000) / 50000 = 2.0
    conn = sqlite3.connect(test_db)
    row = conn.execute("SELECT raw_value, normalized_value FROM timeseries_metrics WHERE metric_name = 'unrealized_sell_risk'").fetchone()
    conn.close()
    
    assert row[0] == pytest.approx(2.0)
    # Top-only thresholds: t_minus_1=1.8, t_minus_2=2.2. raw=2.0 is midpoint, maps to -1.5
    assert row[1] == pytest.approx(-1.5)

@patch('quant.components.sharpe_ratio_52w.fetch_series')
def test_sharpe_ratio_52w_component(mock_fetch, test_db):
    comp = SharpeRatio52wComponent(db_path=test_db)
    
    # 366 days of prices (1.0 index increase each day, log returns constant)
    dates = pd.date_range(start="2025-01-01", periods=366).strftime("%Y-%m-%dT00:00:00Z")
    prices = [100.0 * (1.01 ** i) for i in range(366)]
    mock_fetch.return_value = pd.DataFrame([{"date": d, "value": p} for d, p in zip(dates, prices)])
    
    res = comp.run_pipeline(full_rebuild=True)
    assert res["status"] == "success"
    # The first 364 rows have NaN raw_value (rolling window 365) and are skipped.
    # Out of 366 rows, index 0 is first, log_return is NaN. So rolling mean starts at index 365.
    # Thus, we store exactly 1 row.
    assert res["rows_stored"] == 1

@patch('quant.components.pi_cycle_top.fetch_series')
def test_pi_cycle_top_component(mock_fetch, test_db):
    comp = PiCycleTopComponent(db_path=test_db)
    
    dates = pd.date_range(start="2025-01-01", periods=351).strftime("%Y-%m-%dT00:00:00Z")
    prices = [100.0] * 351
    mock_fetch.return_value = pd.DataFrame([{"date": d, "value": p} for d, p in zip(dates, prices)])
    
    res = comp.run_pipeline(full_rebuild=True)
    assert res["status"] == "success"
    # rolling window is 350. Out of 351 rows, first 349 rows are NaN. We store 2 rows.
    assert res["rows_stored"] == 2

@patch('quant.components.vpli.fetch_series')
def test_vpli_component(mock_fetch, test_db):
    comp = VpliComponent(db_path=test_db)
    
    # Needs at least 365 rows for rolling std of log returns
    dates = pd.date_range(start="2025-01-01", periods=366).strftime("%Y-%m-%dT00:00:00Z")
    prices = [1000.0] * 366
    mock_fetch.return_value = pd.DataFrame([{"date": d, "value": p} for d, p in zip(dates, prices)])
    
    res = comp.run_pipeline(full_rebuild=True)
    assert res["status"] == "success"

@patch('quant.components.risk_metrics.fetch_series')
def test_risk_metrics_component(mock_fetch, test_db):
    comp = RiskMetricsComponent(db_path=test_db)
    
    dates = pd.date_range(start="2025-01-01", periods=375).strftime("%Y-%m-%dT00:00:00Z")
    prices = [100.0] * 375
    mock_fetch.return_value = pd.DataFrame([{"date": d, "value": p} for d, p in zip(dates, prices)])
    
    res = comp.run_pipeline(full_rebuild=True)
    assert res["status"] == "success"
    # rolling window 374. 375 rows -> 2 stored
    assert res["rows_stored"] == 2

@patch('quant.components.dvrsi.fetch_series')
def test_dvrsi_component(mock_fetch, test_db):
    comp = DvrsiComponent(db_path=test_db)
    
    dates = pd.date_range(start="2025-01-01", periods=20, freq="W").strftime("%Y-%m-%dT00:00:00Z")
    mock_fetch.side_effect = [
        pd.DataFrame([{"date": d, "value": 40000.0} for d in dates]), # price
        pd.DataFrame([{"date": d, "value": 100000.0} for d in dates])  # transfer_volume_sum_1w
    ]
    
    res = comp.run_pipeline(full_rebuild=True)
    assert res["status"] == "success"
    assert res["rows_stored"] == 134

@patch('quant.components.williams_r.fetch_series')
def test_williams_r_component(mock_fetch, test_db):
    comp = WilliamsRComponent(db_path=test_db)
    
    dates = pd.date_range(start="2025-01-01", periods=80, freq="W").strftime("%Y-%m-%dT00:00:00Z")
    # mock returns DataFrame with OHLC columns
    mock_fetch.return_value = pd.DataFrame([{"date": d, "open": 10.0, "high": 15.0, "low": 8.0, "close": 12.0, "value": 12.0} for d in dates])
    
    res = comp.run_pipeline(full_rebuild=True)
    assert res["status"] == "success"
    # resampled to daily. 10 weeks of valid data -> 64 daily rows stored
    assert res["rows_stored"] == 64

@patch('quant.components.two_year_ma.fetch_series')
def test_two_year_ma_component(mock_fetch, test_db):
    comp = TwoYearMaComponent(db_path=test_db)
    
    dates = pd.date_range(start="2025-01-01", periods=731).strftime("%Y-%m-%dT00:00:00Z")
    prices = [100.0] * 731
    mock_fetch.return_value = pd.DataFrame([{"date": d, "value": p} for d, p in zip(dates, prices)])
    
    res = comp.run_pipeline(full_rebuild=True)
    assert res["status"] == "success"
    # rolling window 730. 731 rows -> 2 stored
    assert res["rows_stored"] == 2

@patch('quant.components.ahr999.fetch_series')
def test_ahr999_component(mock_fetch, test_db):
    comp = Ahr999Component(db_path=test_db)
    
    dates = pd.date_range(start="2025-01-01", periods=205).strftime("%Y-%m-%dT00:00:00Z")
    prices = [100.0] * 205
    mock_fetch.return_value = pd.DataFrame([{"date": d, "value": p} for d, p in zip(dates, prices)])
    
    res = comp.run_pipeline(full_rebuild=True)
    assert res["status"] == "success"
    # rolling window 200. 205 rows -> 6 stored
    assert res["rows_stored"] == 6

@patch('quant.components.fear_greed_og.fetch_series')
@patch('quant.components.fear_greed_og.requests.get')
def test_fear_greed_og_component(mock_get, mock_fetch, test_db):
    comp = FearGreedOgComponent(db_path=test_db)
    
    # Mock requests.get for Alternative.me FNG API
    mock_response = MagicMock()
    mock_response.json.return_value = {
        "data": [
            {"timestamp": "1780272000", "value": "29", "value_classification": "Fear"},
            {"timestamp": "1780185600", "value": "28", "value_classification": "Fear"}
        ]
    }
    mock_get.return_value = mock_response
    
    # Mock fetch_series for BTC Price
    mock_fetch.return_value = pd.DataFrame([
        {"date": "2026-06-01T00:00:00Z", "value": 100000.0},
        {"date": "2026-05-31T00:00:00Z", "value": 99000.0}
    ])
    
    res = comp.run_pipeline(full_rebuild=True)
    assert res["status"] == "success"
    assert res["rows_stored"] == 2

    # Verify SMA smoothing (28.0 and 28.5)
    conn = sqlite3.connect(test_db)
    rows = conn.execute("SELECT date, raw_value FROM timeseries_metrics WHERE metric_name = 'fear_greed_og' ORDER BY date ASC").fetchall()
    conn.close()
    assert rows[0][1] == pytest.approx(28.0)
    assert rows[1][1] == pytest.approx(28.5)

@patch('quant.components.fear_greed_cmc.fetch_series')
@patch('quant.components.fear_greed_cmc.requests.get')
def test_fear_greed_cmc_component(mock_get, mock_fetch, test_db):
    comp = FearGreedCmcComponent(db_path=test_db)
    
    # Mock requests.get for CMC Trial API
    mock_response = MagicMock()
    mock_response.json.return_value = {
        "data": [
            {"timestamp": "1780272000", "value": 30, "value_classification": "Fear"},
            {"timestamp": "1780185600", "value": 35, "value_classification": "Fear"}
        ]
    }
    mock_get.return_value = mock_response
    
    # Mock fetch_series for BTC Price
    mock_fetch.return_value = pd.DataFrame([
        {"date": "2026-06-01T00:00:00Z", "value": 100000.0},
        {"date": "2026-05-31T00:00:00Z", "value": 99000.0}
    ])
    
    res = comp.run_pipeline(full_rebuild=True)
    assert res["status"] == "success"
    assert res["rows_stored"] == 2

    # Verify SMA smoothing (35.0 and 32.5)
    conn = sqlite3.connect(test_db)
    rows = conn.execute("SELECT date, raw_value FROM timeseries_metrics WHERE metric_name = 'fear_greed_cmc' ORDER BY date ASC").fetchall()
    conn.close()
    assert rows[0][1] == pytest.approx(35.0)
    assert rows[1][1] == pytest.approx(32.5)
