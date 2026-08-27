#!/usr/bin/env python3
"""
Chikou Span Forensic Analysis for 2026-08-23.
Computes exact coordinates at displacement bars t-26 and t-60,
breaks down S_Chikou into its component parts.
"""

import sys, os
import sqlite3
import numpy as np
import pandas as pd

ENGINE_SRC = os.path.join(os.path.dirname(__file__), '..', 'engines', 'ichimoku', 'src')
sys.path.insert(0, ENGINE_SRC)
from ichimoku_quant.features import generate_ichimoku_features, compute_atr, ehler_supersmoother

DB = os.path.join(os.path.dirname(__file__), '..', 'data', 'maftia_quant.db')
TARGET = '2026-08-23'

def load_data():
    conn = sqlite3.connect(DB)
    df = pd.read_sql(
        "SELECT date, open as Open, high as High, low as Low, close as Close "
        "FROM master_ohlcv ORDER BY date", conn)
    conn.close()
    df['date'] = pd.to_datetime(df['date'])
    df.set_index('date', inplace=True)
    for c in ['Open', 'High', 'Low', 'Close']:
        df[c] = df[c].astype(float)
    return df

def main():
    df = load_data()
    df = generate_ichimoku_features(df)

    # ── 1. Current bar t = 2026-08-23 ──
    t = pd.Timestamp(TARGET)
    row_t = df.loc[t]
    close_t = row_t['Close']
    tenkan_t = row_t['tenkan_sen']
    kijun_t = row_t['kijun_sen']
    span_a_t = row_t['senkou_span_a']
    span_b_t = row_t['senkou_span_b']
    cloud_top_t = max(span_a_t, span_b_t)
    cloud_bot_t = min(span_a_t, span_b_t)
    atr_t = row_t['ATR']

    # ── 2. Displacement bar t-60 = 2026-06-24 ──
    t_minus_60 = t - pd.Timedelta(days=60)
    # Find the actual trading day
    idx_60 = df.index.get_indexer([t_minus_60], method='nearest')[0]
    t60 = df.index[idx_60]
    row_60 = df.loc[t60]
    close_60 = row_60['Close']
    span_a_60 = row_60['senkou_span_a']
    span_b_60 = row_60['senkou_span_b']
    cloud_top_60 = max(span_a_60, span_b_60)
    cloud_bot_60 = min(span_a_60, span_b_60)

    # ── 3. Canonical displacement bar t-26 = 2026-07-28 ──
    t_minus_26 = t - pd.Timedelta(days=26)
    idx_26 = df.index.get_indexer([t_minus_26], method='nearest')[0]
    t26 = df.index[idx_26]
    row_26 = df.loc[t26]
    close_26 = row_26['Close']
    span_a_26 = row_26['senkou_span_a']
    span_b_26 = row_26['senkou_span_b']
    cloud_top_26 = max(span_a_26, span_b_26)
    cloud_bot_26 = min(span_a_26, span_b_26)

    # ── 4. S_Chikou breakdown ──
    # S_Chikou = tanh(SuperSmoother(Close[t] - Close[t-60]) / ATR[t], length=4)
    raw_diff = close_t - close_60
    raw_chikou_dist = raw_diff / atr_t

    # Build the series for the supersmoother
    # We need Close[t] - Close[t-60] for a window around t
    p2 = 60
    chikou_dist_series = (df['Close'] - df['Close'].shift(p2)) / df['ATR']
    smoothed = ehler_supersmoother(chikou_dist_series, length=4)
    s_chikou_raw = smoothed.loc[t]
    s_chikou_final = np.tanh(s_chikou_raw)

    # Also compute what the "ideal" chikou span is
    chikou_span = df['Close'].shift(-p2)  # visualization chikou

    # ── PRINT RESULTS ──
    W = 110
    print()
    print("=" * W)
    print(f"  CHIKOU SPAN FORENSIC ANALYSIS: {TARGET} (t = {t.strftime('%Y-%m-%d')})")
    print("=" * W)
    print()

    # Section 1: Current bar
    print("─" * W)
    print(f"  1. CURRENT BAR t = {t.strftime('%Y-%m-%d')} (Close = ${close_t:,.2f})")
    print("─" * W)
    print(f"  Close_t                   = ${close_t:>12,.2f}")
    print(f"  Tenkan-Sen (p1=20)        = ${tenkan_t:>12,.2f}")
    print(f"  Kijun-Sen (p2=60)         = ${kijun_t:>12,.2f}")
    print(f"  Senkou A (shifted +60)     = ${span_a_t:>12,.2f}")
    print(f"  Senkou B (shifted +60)     = ${span_b_t:>12,.2f}")
    print(f"  Cloud Top                  = ${cloud_top_t:>12,.2f}")
    print(f"  Cloud Bottom               = ${cloud_bot_t:>12,.2f}")
    print(f"  ATR (p2=60)                = ${atr_t:>12,.2f}")
    print(f"  Price vs Cloud: {'ABOVE' if close_t > cloud_top_t else 'INSIDE' if close_t > cloud_bot_t else 'BELOW'} (gap = ${close_t - cloud_top_t:>+12,.2f})")
    print()

    # Section 2: t-60
    print("─" * W)
    print(f"  2. DISPLACEMENT BAR t-60 = {t60.strftime('%Y-%m-%d')} (Close = ${close_60:,.2f})")
    print("─" * W)
    print(f"  Close_{t60.strftime('%Y-%m-%d')}  = ${close_60:>12,.2f}")
    print(f"  Senkou A at t-60            = ${span_a_60:>12,.2f}")
    print(f"  Senkou B at t-60            = ${span_b_60:>12,.2f}")
    print(f"  Cloud Top at t-60           = ${cloud_top_60:>12,.2f}")
    print(f"  Cloud Bottom at t-60        = ${cloud_bot_60:>12,.2f}")
    print()
    print(f"  Chikou Span = Close_t       = ${close_t:>12,.2f}")
    print(f"  vs Close_{t60.strftime('%Y-%m-%d')}          = ${close_t - close_60:>+12,.2f} ({'ABOVE' if close_t > close_60 else 'BELOW'} price 60 bars ago)")
    print(f"  vs Cloud Top at t-60        = ${close_t - cloud_top_60:>+12,.2f} ({'ABOVE' if close_t > cloud_top_60 else 'BELOW'} cloud 60 bars ago)")
    print()

    # Section 3: t-26
    print("─" * W)
    print(f"  3. CANONICAL DISPLACEMENT BAR t-26 = {t26.strftime('%Y-%m-%d')} (Close = ${close_26:,.2f})")
    print("─" * W)
    print(f"  Close_{t26.strftime('%Y-%m-%d')}  = ${close_26:>12,.2f}")
    print(f"  Senkou A at t-26            = ${span_a_26:>12,.2f}")
    print(f"  Senkou B at t-26            = ${span_b_26:>12,.2f}")
    print(f"  Cloud Top at t-26           = ${cloud_top_26:>12,.2f}")
    print(f"  Cloud Bottom at t-26        = ${cloud_bot_26:>12,.2f}")
    print()
    print(f"  Chikou Span = Close_t       = ${close_t:>12,.2f}")
    print(f"  vs Close_{t26.strftime('%Y-%m-%d')}          = ${close_t - close_26:>+12,.2f} ({'ABOVE' if close_t > close_26 else 'BELOW'} price 26 bars ago)")
    print(f"  vs Cloud Top at t-26        = ${close_t - cloud_top_26:>+12,.2f} ({'ABOVE' if close_t > cloud_top_26 else 'BELOW'} cloud 26 bars ago)")
    print()

    # Section 4: S_Chikou breakdown
    print("─" * W)
    print(f"  4. S_CHIKOU COMPONENT BREAKDOWN")
    print("─" * W)
    print(f"  Formula: S_Chikou = tanh(SuperSmoother((Close_t - Close_t-60) / ATR_t, length=4))")
    print()
    print(f"  Close_t ({t.strftime('%Y-%m-%d')})           = ${close_t:>12,.2f}")
    print(f"  Close_{t60.strftime('%Y-%m-%d')} (t-60)     = ${close_60:>12,.2f}")
    print(f"  Raw Price Diff              = ${raw_diff:>12,.2f}")
    print(f"  ATR_t (p2=60)              = ${atr_t:>12,.2f}")
    print(f"  Raw Chikou Dist (diff/ATR)  = {raw_chikou_dist:>12.6f}")
    print()
    print(f"  SuperSmoother Output        = {s_chikou_raw:>12.6f}")
    print(f"  tanh(Output)                = {s_chikou_final:>12.6f}")
    print(f"  S_Chikou (from features)    = {row_t.get('S_Chikou', 'N/A'):>12.6f}")
    print()

    # Verify against stored value
    stored = row_t.get('S_Chikou', None)
    if stored is not None and not pd.isna(stored):
        match = abs(s_chikou_final - stored) < 0.001
        print(f"  Verification: {'✓ MATCH' if match else '✗ MISMATCH'} (computed={s_chikou_final:.6f}, stored={stored:.6f})")
    print()

    # Section 5: Visual diagram
    print("─" * W)
    print(f"  5. VISUAL: CHIKOU SPAN PLACEMENT")
    print("─" * W)
    print()
    print(f"  Timeline (trading days):")
    print()
    print(f"  {t60.strftime('%Y-%m-%d')} (t-60)         {t26.strftime('%Y-%m-%d')} (t-26)              {t.strftime('%Y-%m-%d')} (t)")
    print(f"  ─────────────┼───────────────────────┼─────────────────────┼──────────────")
    print(f"  Cloud(t-60):  |  Cloud(t-26):         |  Cloud(t):          |")
    print(f"  Top: ${cloud_top_60:>8,.0f} |  Top: ${cloud_top_26:>8,.0f}      |  Top: ${cloud_top_t:>8,.0f}    |")
    print(f"  Bot: ${cloud_bot_60:>8,.0f} |  Bot: ${cloud_bot_26:>8,.0f}      |  Bot: ${cloud_bot_t:>8,.0f}    |")
    print(f"  Price:${close_60:>8,.0f} |  Price:${close_26:>8,.0f}        |  Price:${close_t:>8,.0f}    |")
    print()
    print(f"  Chikou Span plotted at t = ${close_t:,.0f}")
    print(f"  ├── vs Price at t-26: ${close_t:,.0f} vs ${close_26:,.0f} = ${close_t-close_26:+,.0f} {'✓ ABOVE' if close_t > close_26 else '✗ BELOW'}")
    print(f"  ├── vs Cloud at t-26: ${close_t:,.0f} vs Top ${cloud_top_26:,.0f} = ${close_t-cloud_top_26:+,.0f} {'✓ ABOVE' if close_t > cloud_top_26 else '✗ BELOW'}")
    print(f"  ├── vs Price at t-60: ${close_t:,.0f} vs ${close_60:,.0f} = ${close_t-close_60:+,.0f} {'✓ ABOVE' if close_t > close_60 else '✗ BELOW'}")
    print(f"  └── vs Cloud at t-60: ${close_t:,.0f} vs Top ${cloud_top_60:,.0f} = ${close_t-cloud_top_60:+,.0f} {'✓ ABOVE' if close_t > cloud_top_60 else '✗ BELOW'}")
    print()

    # Section 6: Explanation
    print("─" * W)
    print(f"  6. WHY CHIKOU IS ABOVE PRICE AND CLOUD")
    print("─" * W)
    print()
    print(f"  The Chikou Span at {t.strftime('%Y-%m-%d')} is plotted at ${close_t:,.2f}.")
    print(f"  It is compared against TWO historical reference points:")
    print()
    print(f"  At t-26 ({t26.strftime('%Y-%m-%d')}):")
    if close_t > close_26:
        print(f"    Price was ${close_26:,.0f}. The Chikou at ${close_t:,.0f} is ${close_t-close_26:+,.0f} ABOVE")
        print(f"    the price 26 days ago. This means BTC rallied ${close_t-close_26:,.0f} over the past month.")
    else:
        print(f"    Price was ${close_26:,.0f}. The Chikou at ${close_t:,.0f} is BELOW.")
    print()
    if close_t > cloud_top_26:
        print(f"    Cloud Top was ${cloud_top_26:,.0f}. The Chikou at ${close_t:,.0f} is ABOVE the cloud")
        print(f"    that existed 26 days ago. This is a bullish confirmation signal.")
    else:
        print(f"    Cloud Top was ${cloud_top_26:,.0f}. The Chikou is BELOW the cloud — no confirmation.")
    print()
    print(f"  At t-60 ({t60.strftime('%Y-%m-%d')}):")
    if close_t > close_60:
        print(f"    Price was ${close_60:,.0f}. The Chikou at ${close_t:,.0f} is ${close_t-close_60:+,.0f} ABOVE")
        print(f"    the price 60 days ago. This means BTC rallied ${close_t-close_60:,.0f} over 2 months.")
    else:
        print(f"    Price was ${close_60:,.0f}. The Chikou is BELOW.")
    print()
    if close_t > cloud_top_60:
        print(f"    Cloud Top was ${cloud_top_60:,.0f}. The Chikou at ${close_t:,.0f} is ABOVE the cloud")
        print(f"    that existed 60 days ago. Double bullish confirmation.")
    else:
        print(f"    Cloud Top was ${cloud_top_60:,.0f}. No cloud confirmation at t-60.")
    print()
    print(f"  The S_Chikou value of {s_chikou_final:.4f} (tanh-bounded [-1, 1]) quantifies this:")
    print(f"    - S_Chikou > 0 means Chikou is above historical price (bullish)")
    print(f"    - S_Chikou close to +1.0 means the raw distance is large relative to ATR")
    print(f"    - At {s_chikou_final:.4f}, the smoothed Chikou displacement is {abs(s_chikou_raw):.2f}x ATR")
    print(f"      ({'strongly' if abs(s_chikou_raw) > 2 else 'moderately'} {'above' if s_chikou_raw > 0 else 'below'} historical price)")
    print()

    # Section 7: Gate check
    print("─" * W)
    print(f"  7. GATE STATUS (from strategy.py)")
    print("─" * W)
    chikou_above_cloud_26 = close_t > cloud_top_26 if not pd.isna(cloud_top_26) else False
    chikou_above_cloud_60 = close_t > cloud_top_60 if not pd.isna(cloud_top_60) else False
    s_chikou_positive = row_t.get('S_Chikou', 0) > 0.0

    print(f"  gate_chikou (S_Chikou > 0.0):   {'✓ PASS' if s_chikou_positive else '✗ FAIL'} (S_Chikou = {row_t.get('S_Chikou', 'N/A')})")
    print(f"  Chikou > Price at t-26:          {'✓ PASS' if close_t > close_26 else '✗ FAIL'} (${close_t:,.0f} vs ${close_26:,.0f})")
    print(f"  Chikou > Cloud at t-26:          {'✓ PASS' if chikou_above_cloud_26 else '✗ FAIL'} (${close_t:,.0f} vs ${cloud_top_26:,.0f})")
    print(f"  Chikou > Price at t-60:          {'✓ PASS' if close_t > close_60 else '✗ FAIL'} (${close_t:,.0f} vs ${close_60:,.0f})")
    print(f"  Chikou > Cloud at t-60:          {'✓ PASS' if chikou_above_cloud_60 else '✗ FAIL'} (${close_t:,.0f} vs ${cloud_top_60:,.0f})")
    print()
    print("=" * W)
    print("Done.")

if __name__ == "__main__":
    main()
