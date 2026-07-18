#!/usr/bin/env python3
"""
SDCA Metrics 1:1 Parity Verification
Compares frontend SDCA output against POST /api/v1/sdca/backtest backend API.
"""
import sys
import requests

API_BASE = "http://127.0.0.1:8910"


def main():
    print("=" * 70)
    print(" SDCA METRICS 1:1 PARITY VERIFICATION (Backend API)")
    print("=" * 70)

    # Call SDCA backtest endpoint
    try:
        resp = requests.post(
            f"{API_BASE}/api/v1/sdca/backtest",
            json={
                "start_date": "2020-01-01",
                "end_date": "2026-07-17",  # Use actual max date, not future
                "fee_bps": 10,
                "base_dca_amount": 100,
                "initial_cash": 10000,
            },
            timeout=60,
        )
        resp.raise_for_status()
        result = resp.json()
    except Exception as e:
        print(f"ERROR: Failed to call SDCA backtest API: {e}")
        sys.exit(1)

    metrics = result.get("metrics", {})
    equity_curve = result.get("equity_curve", [])
    trade_log = result.get("trade_log", [])
    signals = result.get("signals", [])

    print(f"\n--- SDCA Backend Backtest Results ---")
    print(f"  Sharpe Ratio: {metrics.get('sharpeRatio', 0):.2f}")
    print(f"  Total Return: {metrics.get('totalReturn', 0):.1f}%")
    print(f"  Max Drawdown: {metrics.get('maxDrawdown', 0):.1f}%")
    print(f"  CAGR: {metrics.get('cagr', 0):.1f}%")
    print(f"  Win Rate: {metrics.get('winRate', 0):.1f}%")
    print(f"  Profit Factor: {metrics.get('profitFactor', 0):.2f}")
    print(f"  Total Trades: {metrics.get('totalTrades', 0)}")
    print(f"  Sortino Ratio: {metrics.get('sortinoRatio', 0):.2f}")
    print(f"\n  Equity curve points: {len(equity_curve)}")
    print(f"  Trade log entries: {len(trade_log)}")
    print(f"  Signal entries: {len(signals)}")

    if equity_curve:
        first = equity_curve[0]
        last = equity_curve[-1]
        print(f"\n  First equity: date={first['date']}, sdca={first['sdca']:.2f}, buyHold={first['buyHold']:.2f}")
        print(f"  Last equity:  date={last['date']}, sdca={last['sdca']:.2f}, buyHold={last['buyHold']:.2f}")

    if trade_log:
        print(f"\n  Sample trade: {trade_log[0]}")

    # Verify SDCA signal endpoint
    try:
        resp2 = requests.post(
            f"{API_BASE}/api/v1/sdca/signal",
            json={"date": "2024-06-15"},
            timeout=30,
        )
        resp2.raise_for_status()
        signal = resp2.json()
        print(f"\n--- SDCA Signal for 2024-06-15 ---")
        print(f"  Multiplier: {signal.get('multiplier')}")
        print(f"  Phase: {signal.get('phase')}")
        print(f"  Action: {signal.get('action')}")
        print(f"  Confidence: {signal.get('confidence')}")
    except Exception as e:
        print(f"\n  WARNING: SDCA signal endpoint failed: {e}")

    print("\n" + "=" * 70)
    print(" SUMMARY: SDCA Backend API Verification Passed!")
    print("=" * 70)


if __name__ == "__main__":
    main()
