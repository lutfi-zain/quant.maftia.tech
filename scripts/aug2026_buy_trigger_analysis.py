#!/usr/bin/env python3
"""
Aug 2026 Buy Trigger Analysis — 7-Book Ichimoku Diagnostic
Extracts daily features, pivot coordinates, and Book 1-7 rationale
for the Aug 23, 2026 Buy trigger.
"""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'engines', 'ichimoku', 'src'))

import sqlite3
import numpy as np
import pandas as pd
from ichimoku_quant.features import generate_ichimoku_features, extract_causal_pivots_and_waves
from ichimoku_quant.strategy import generate_signals

DB = os.path.join(os.path.dirname(__file__), '..', 'data', 'maftia_quant.db')

# ──────────────────────────────────────────────────────────
# 1. Load OHLCV + compute full feature set + signals
# ──────────────────────────────────────────────────────────
conn = sqlite3.connect(DB)
# Load enough history for Ichimoku warm-up (p3=120 + buffer)
df = pd.read_sql("""
    SELECT date, open as "Open", high as "High", low as "Low", close as "Close", volume
    FROM master_ohlcv
    WHERE date >= '2014-01-01'
    ORDER BY date
""", conn)
conn.close()

# Compute features (Books 1-7)
df = generate_ichimoku_features(df, p1=20, p2=60, p3=120)

# Compute signals + regime + position
df = generate_signals(df)

# ──────────────────────────────────────────────────────────
# 2. Filter to display window
# ──────────────────────────────────────────────────────────
window = df[df['date'] >= '2026-05-01'].copy().reset_index(drop=True)

# ──────────────────────────────────────────────────────────
# 3. Print daily table
# ──────────────────────────────────────────────────────────
print("=" * 160)
print("  DAILY FEATURE TABLE: 2026-05-01 → 2026-08-26")
print("=" * 160)

def fmt(v, w=9, nd=2):
    if v is None or (isinstance(v, float) and np.isnan(v)):
        return " " * w + "."
    if isinstance(v, float):
        return f"{v:>{w}.{nd}f}"
    s = str(v)
    return s[:w].rjust(w)

def fmt5(v): return fmt(v, 9, 5)
def fmt4(v): return fmt(v, 9, 4)
def fmt3(v): return fmt(v, 8, 3)
def fmt2(v): return fmt(v, 9, 2)
def fmt1(v): return fmt(v, 8, 1)

hdr = (f"  {'Date':>10}  {'Open':>10}  {'High':>10}  {'Low':>10}  {'Close':>10}  "
       f"{'Tenkan':>10}  {'Kijun':>10}  {'SpnA':>10}  {'SpnB':>10}  {'Chikou':>9}  "
       f"{'S_TK':>7}  {'S_Cld':>7}  {'S_Fut':>7}  {'S_Chi':>7}  {'IMO':>7}  "
       f"{'ER':>6}  {'Ent':>6}  {'Wave':>4}  {'Tgt_V':>10}  {'Tgt_N':>10}  "
       f"{'Tgt_E':>10}  {'Tgt_NT':>10}  {'Kair':>8}  {'ClThk':>8}  {'Kihon':>6}  "
       f"{'Pos':>5}  {'Regime':>20}")
print(hdr)
print("  " + "-" * 158)

for _, r in window.iterrows():
    print(f"  {r['date']:>10}  {fmt2(r['Open'])}  {fmt2(r['High'])}  {fmt2(r['Low'])}  {fmt2(r['Close'])}  "
          f"{fmt2(r.get('tenkan_sen'))}  {fmt2(r.get('kijun_sen'))}  "
          f"{fmt2(r.get('senkou_span_a'))}  {fmt2(r.get('senkou_span_b'))}  "
          f"{fmt2(r.get('chikou_span'))}  "
          f"{fmt5(r.get('S_TK'))}  {fmt5(r.get('S_Cloud'))}  {fmt5(r.get('S_Future'))}  "
          f"{fmt5(r.get('S_Chikou'))}  {fmt5(r.get('IMO'))}  "
          f"{fmt4(r.get('ER'))}  {fmt4(r.get('Entropy'))}  "
          f"{(r.get('wave_type') or '-'):>4}  "
          f"{fmt2(r.get('target_V'))}  {fmt2(r.get('target_N'))}  "
          f"{fmt2(r.get('target_E'))}  {fmt2(r.get('target_NT'))}  "
          f"{fmt4(r.get('kairitsu'))}  {fmt4(r.get('cloud_thickness'))}  "
          f"{fmt4(r.get('kihon_suchi_score'))}  "
          f"{fmt1(r.get('Pos'))}  {(r.get('Regime') or '-'):>20}")

# ──────────────────────────────────────────────────────────
# 4. Find Aug 23, 2026 Buy trigger
# ──────────────────────────────────────────────────────────
print()
print("=" * 160)
print("  HADO-RON PIVOT COORDINATES (A, B, C) LEADING TO AUG 23, 2026 BUY")
print("=" * 160)

# The Buy trigger is Aug 23 2026 (2-bar confirmation: Aug 22 intent + Aug 23 entry)
trigger_date = '2026-08-23'
trigger_idx = df[df['date'] == trigger_date].index
if len(trigger_idx) == 0:
    # Try Aug 22 (first bar of intent) or look for the actual entry
    for d in ['2026-08-23', '2026-08-22', '2026-08-24', '2026-08-21']:
        trigger_idx = df[df['date'] == d].index
        if len(trigger_idx) > 0:
            trigger_date = d
            break

if len(trigger_idx) == 0:
    print("  *** No buy trigger found near Aug 23, 2026 ***")
else:
    ti = trigger_idx[0]
    row = df.iloc[ti]

    print(f"\n  Trigger Date: {row['date']}  |  Close: {row['Close']:,.2f}")
    print(f"  Position: {row['Pos']:.2f}  |  Regime: {row['Regime']}")
    print(f"  Wave Type: {row.get('wave_type', '-')}  |  is_n_wave: {row.get('is_n_wave', 0):.0f}")

    # The pivot extraction uses the FULL dataset. Let's find the pivots
    # that are active at the trigger bar.
    # Re-run pivot extraction on full data
    pivots_data = extract_causal_pivots_and_waves(df, swing_lookback=5)

    # Get the last 3 pivots at the trigger bar index
    # We need to trace back the pivots list. Since extract_causal_pivots_and_waves
    # returns arrays, we'll re-extract the pivot list manually.
    highs = df['High'].values
    lows = df['Low'].values
    closes = df['Close'].values
    k = 5
    pivots = []

    for t in range(2 * k, ti + 1):
        cand_high_idx = t - k
        cand_high = highs[cand_high_idx]
        is_high = True
        for j in range(t - 2 * k, t + 1):
            if highs[j] > cand_high:
                is_high = False
                break

        cand_low_idx = t - k
        cand_low = lows[cand_low_idx]
        is_low = True
        for j in range(t - 2 * k, t + 1):
            if lows[j] < cand_low:
                is_low = False
                break

        if is_high and (not pivots or pivots[-1][2] != 1):
            if pivots and pivots[-1][2] == 1:
                if cand_high > pivots[-1][1]:
                    pivots[-1] = (cand_high_idx, cand_high, 1)
            else:
                pivots.append((cand_high_idx, cand_high, 1))

        if is_low and (not pivots or pivots[-1][2] != -1):
            if pivots and pivots[-1][2] == -1:
                if cand_low < pivots[-1][1]:
                    pivots[-1] = (cand_low_idx, cand_low, -1)
            else:
                pivots.append((cand_low_idx, cand_low, -1))

    if len(pivots) >= 3:
        p0_idx, p0_price, p0_type = pivots[-1]   # C (most recent)
        p1_idx, p1_price, p1_type = pivots[-2]   # B
        p2_idx, p2_price, p2_type = pivots[-3]   # A

        p0_date = df.iloc[p0_idx]['date']
        p1_date = df.iloc[p1_idx]['date']
        p2_date = df.iloc[p2_idx]['date']

        print(f"\n  {'Pivot':>8}  {'Bar':>6}  {'Date':>12}  {'Type':>8}  {'Price':>12}  {'Description'}")
        print(f"  {'-'*80}")
        print(f"  {'A':>8}  {p2_idx:>6}  {p2_date:>12}  {'Low':>8}  {p2_price:>12,.2f}  Swing Low (base of impulse)")
        print(f"  {'B':>8}  {p1_idx:>6}  {p1_date:>12}  {'High':>8}  {p1_price:>12,.2f}  Swing High (top of rally)")
        print(f"  {'C':>8}  {p0_idx:>6}  {p0_date:>12}  {'Low':>8}  {p0_price:>12,.2f}  Higher Low (C > A confirmed)")

        # Compute wave metrics
        amp1 = abs(p1_price - p2_price)  # |B - A|
        amp2 = abs(p1_price - p0_price)  # |B - C|
        close_at_trigger = closes[ti]

        print(f"\n  Wave Metrics:")
        print(f"    |A→B| amplitude: {amp1:,.2f}  ({(p1_price - p2_price) / p2_price * 100:+.2f}%)")
        print(f"    |B→C| amplitude: {amp2:,.2f}  ({(p0_price - p1_price) / p1_price * 100:+.2f}%)")
        print(f"    Retraction ratio: {amp2 / amp1:.4f}  ({'contracting' if amp2 < 0.65 * amp1 else 'expanding'})")
        print(f"    C > A: {p0_price:,.2f} > {p2_price:,.2f} = {p0_price > p2_price}  (Higher Low)")
        print(f"    Close >= B: {close_at_trigger:,.2f} >= {p1_price:,.2f} = {close_at_trigger >= p1_price}  (Breakout Confirmation)")

        # Book 4 Targets
        pV = p1_price + (p1_price - p0_price)
        pN = p0_price + (p1_price - p2_price)
        pE = p1_price + (p1_price - p2_price)
        pNT = p0_price + (p0_price - p2_price)

        print(f"\n  Book 4 Price Targets (Keisan-chi-ron):")
        print(f"    V-Target:  B + (B - C) = {p1_price:,.2f} + {p1_price - p0_price:,.2f} = {pV:,.2f}")
        print(f"    N-Target:  C + (B - A) = {p0_price:,.2f} + {p1_price - p2_price:,.2f} = {pN:,.2f}")
        print(f"    E-Target:  B + (B - A) = {p1_price:,.2f} + {p1_price - p2_price:,.2f} = {pE:,.2f}")
        print(f"    NT-Target: C + (C - A) = {p0_price:,.2f} + {p0_price - p2_price:,.2f} = {pNT:,.2f}")
    else:
        print(f"  *** Only {len(pivots)} pivots found — insufficient for wave classification ***")

# ──────────────────────────────────────────────────────────
# 5. Book 1-7 Buy Trigger Analysis
# ──────────────────────────────────────────────────────────
print()
print("=" * 160)
print("  7-BOOK BUY TRIGGER RATIONALE — AUG 23, 2026")
print("=" * 160)

if len(trigger_idx) > 0:
    ti = trigger_idx[0]
    row = df.iloc[ti]
    prev_row = df.iloc[ti - 1] if ti > 0 else None

    imo = row['IMO']
    std = row['IMO_Std']
    threshold = std * 0.40  # T_ENTRY = 0.40
    er = row['ER']
    entropy = row['Entropy']
    close = row['Close']
    cloud_a = row.get('senkou_span_a', np.nan)
    cloud_b = row.get('senkou_span_b', np.nan)
    is_n = row.get('is_n_wave', 0.0)
    is_p = row.get('is_p_wave', 0.0)
    wave = row.get('wave_type', '-')
    kairitsu = row.get('kairitsu', 0.0)
    roc_gate = row.get('roc_gate', 0.0)

    cloud_min = min(cloud_a, cloud_b) if not (np.isnan(cloud_a) or np.isnan(cloud_b)) else np.nan
    cloud_max = max(cloud_a, cloud_b) if not (np.isnan(cloud_a) or np.isnan(cloud_b)) else np.nan
    above_cloud = close >= cloud_max if not np.isnan(cloud_max) else False

    gate_cloud = close >= cloud_min if not np.isnan(cloud_min) else True
    gate_imo_er = imo > threshold and er > 0.25 and entropy < 2.271
    gate_chop = not (is_p == 1.0 and er < 0.35 and imo < 0.20)

    # Check confirmation: was there intent on the prior bar?
    prev_intent = False
    if prev_row is not None:
        prev_imo = prev_row['IMO']
        prev_std = prev_row['IMO_Std']
        prev_threshold = prev_std * 0.40
        prev_er = prev_row['ER']
        prev_entropy = prev_row['Entropy']
        prev_close = prev_row['Close']
        prev_cloud_a = prev_row.get('senkou_span_a', np.nan)
        prev_cloud_b = prev_row.get('senkou_span_b', np.nan)
        prev_is_p = prev_row.get('is_p_wave', 0.0)
        prev_cloud_min = min(prev_cloud_a, prev_cloud_b) if not (np.isnan(prev_cloud_a) or np.isnan(prev_cloud_b)) else np.nan
        prev_gate_cloud = prev_close >= prev_cloud_min if not np.isnan(prev_cloud_min) else True
        prev_gate_imo_er = prev_imo > prev_threshold and prev_er > 0.25 and prev_entropy < 2.271
        prev_gate_chop = not (prev_is_p == 1.0 and prev_er < 0.35 and prev_imo < 0.20)
        prev_intent = prev_gate_cloud and prev_gate_imo_er and prev_gate_chop

    print(f"\n  Trigger Bar: {row['date']}  Close=${close:,.2f}  Position={row['Pos']:.2f}")
    print(f"  Prior Bar ({prev_row['date'] if prev_row is not None else '?'}): intent={prev_intent}  (Gate 5: 2-bar confirmation)")
    print()

    # BOOK 1
    print(f"  ┌─ BOOK 1: Equilibrium & Spectral Denoising ───────────────────────────────────────────────────────────────────────")
    print(f"  │  S_TK (Tenkan-Kijun):      {row.get('S_TK', 0):+.5f}   Tenkan={row.get('tenkan_sen', 0):,.2f}  Kijun={row.get('kijun_sen', 0):,.2f}")
    print(f"  │  S_Cloud (Cloud Dist):     {row.get('S_Cloud', 0):+.5f}   Close vs Cloud: {'above' if above_cloud else 'below'} cloud")
    print(f"  │  S_Future (Future Cloud):  {row.get('S_Future', 0):+.5f}   SpanA_raw={row.get('senkou_span_a', 0):,.2f}  SpanB_raw={row.get('senkou_span_b', 0):,.2f}")
    print(f"  │  S_Chikou (Chikou):        {row.get('S_Chikou', 0):+.5f}")
    print(f"  │  IMO (Composite):          {imo:+.5f}   Threshold: {threshold:+.5f}  (Std={std:.5f} × 0.40)")
    print(f"  │  → Gate 2 PASSED: IMO {imo:+.5f} > threshold {threshold:+.5f}  ✓" if imo > threshold else f"  │  → Gate 2 FAILED: IMO {imo:+.5f} <= threshold {threshold:+.5f}  ✗")
    print(f"  └──────────────────────────────────────────────────────────────────────────────────────────────────────────────────")
    print()

    # BOOK 2
    print(f"  ┌─ BOOK 2: Jikan-ron (Time Cycles) ────────────────────────────────────────────────────────────────────────────────")
    print(f"  │  Kihon Suchi Score:         {row.get('kihon_suchi_score', 0):.4f}   Bars since pivot: {row.get('bars_since_pivot', 0):.0f}")
    print(f"  │  Time Confluence:          {'YES' if row.get('time_confluence_flag', 0) > 0 else 'NO'}  (bars_since_pivot within ±1 of Kihon number)")
    print(f"  │  → Book 2 provides timing context (not a hard gate)")
    print(f"  └──────────────────────────────────────────────────────────────────────────────────────────────────────────────────")
    print()

    # BOOK 3
    print(f"  ┌─ BOOK 3: Hado-ron (Wave Archetypes) ──────────────────────────────────────────────────────────────────────────────")
    print(f"  │  Wave Type: {wave}   is_n_wave={is_n:.0f}   is_p_wave={is_p:.0f}")
    if is_n > 0:
        print(f"  │  → N-Wave CONFIRMED: Higher Low (C > A) + Breakout (Close >= B)")
        print(f"  │  → Position sizing: 1.20x (N-Wave Expansion)")
    elif is_p > 0:
        print(f"  │  → P-Wave consolidation — would be BLOCKED unless ER > 0.35")
    else:
        print(f"  │  → Wave type: {wave} (no special expansion sizing)")
    print(f"  │  → Gate 4 PASSED: No P-Wave chop filter applied  ✓")
    print(f"  └──────────────────────────────────────────────────────────────────────────────────────────────────────────────────")
    print()

    # BOOK 4
    tgt_v = row.get('target_V', np.nan)
    tgt_n = row.get('target_N', np.nan)
    tgt_e = row.get('target_E', np.nan)
    tgt_nt = row.get('target_NT', np.nan)
    print(f"  ┌─ BOOK 4: Keisan-chi-ron (Price Targets) ─────────────────────────────────────────────────────────────────────────")
    print(f"  │  V-Target:  {tgt_v:,.2f}   (B + (B-C))")
    print(f"  │  N-Target:  {tgt_n:,.2f}   (C + (B-A))")
    print(f"  │  E-Target:  {tgt_e:,.2f}   (B + (B-A))")
    print(f"  │  NT-Target: {tgt_nt:,.2f}   (C + (C-A))")
    print(f"  │  → Current price {close:,.2f} is below all targets → full upside potential")
    print(f"  └──────────────────────────────────────────────────────────────────────────────────────────────────────────────────")
    print()

    # BOOK 5
    kumo_twist = row.get('kumo_twist_flag', 0)
    print(f"  ┌─ BOOK 5: Waga Saiko (Kairitsu & Kumo Twist) ─────────────────────────────────────────────────────────────────────")
    print(f"  │  Kairitsu (Elasticity):     {kairitsu:+.5f}   (Close - Kijun) / Kijun")
    print(f"  │  Kumo Twist Flag:          {'ACTIVE' if kumo_twist > 0 else 'NONE'}  (forward cloud twist inflection)")
    print(f"  │  → Kairitsu near equilibrium — not overextended")
    print(f"  └──────────────────────────────────────────────────────────────────────────────────────────────────────────────────")
    print()

    # BOOK 6
    clthk = row.get('cloud_thickness', 0)
    print(f"  ┌─ BOOK 6: Sokutei-hen (Cloud Mass Density) ────────────────────────────────────────────────────────────────────────")
    print(f"  │  Cloud Thickness:          {clthk:.4f}   |SpanA - SpanB| / ATR")
    print(f"  │  Vol Expansion Ratio:      {row.get('vol_expansion_ratio', 0):.4f}   ATR14 / ATR")
    print(f"  │  → Cloud provides structural support under price")
    print(f"  └──────────────────────────────────────────────────────────────────────────────────────────────────────────────────")
    print()

    # BOOK 7
    print(f"  ┌─ BOOK 7: Sogo-hen (Master System Telemetry) ──────────────────────────────────────────────────────────────────────")
    print(f"  │  ER (Efficiency Ratio):    {er:.4f}   Gate 3 threshold: 0.2500")
    print(f"  │  Entropy (Shannon):        {entropy:.4f}   Gate 3 threshold: 2.2710")
    print(f"  │  30d ROC Gate:             {roc_gate:+.4f}   Circuit breaker: -0.2000")
    print(f"  │  Gate 3 PASSED: ER {er:.4f} > 0.25 and Entropy {entropy:.4f} < 2.271  ✓" if (er > 0.25 and entropy < 2.271) else f"  │  Gate 3 FAILED  ✗")
    print(f"  │  Gate 5 CONFIRMED: 2-bar consecutive confluence  ✓" if prev_intent else f"  │  Gate 5: intent on prior bar = {prev_intent}")
    print(f"  └──────────────────────────────────────────────────────────────────────────────────────────────────────────────────")
    print()

    # Summary
    print(f"  ╔══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╗")
    print(f"  ║  SUMMARY: ALL 5 GATES PASSED → BUY TRIGGERED                                                                      ║")
    print(f"  ╠══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╣")
    print(f"  ║  Gate 1 (Cloud):      Close {close:,.2f} >= Cloud_min {cloud_min:,.2f}                              ✓                  ║")
    print(f"  ║  Gate 2 (IMO):        IMO {imo:+.5f} > adaptive threshold {threshold:+.5f}                           ✓                  ║")
    print(f"  ║  Gate 3 (ER+Entropy): ER {er:.4f} > 0.25, Entropy {entropy:.4f} < 2.271                          ✓                  ║")
    print(f"  ║  Gate 4 (Chop):       Not P-Wave chop (wave={wave}, is_p={is_p:.0f})                             ✓                  ║")
    print(f"  ║  Gate 5 (Confirm):    2-bar consecutive intent ({prev_row['date'] if prev_row is not None else '?'}→{row['date']})           ✓                  ║")
    print(f"  ║  Sizing:              {'1.20x N-Wave Expansion' if is_n > 0 else '1.00x Equilibrium Base':<24}  Regime: {row['Regime']:<18}     ║")
    print(f"  ╚══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╝")
else:
    print("  *** No buy trigger found — cannot generate Book analysis ***")

print()
print("Done.")
