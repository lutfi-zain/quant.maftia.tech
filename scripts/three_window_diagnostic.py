#!/usr/bin/env python3
"""
Three-Window Diagnostic: April-May 2025, October 2024, June 2023.
Extracts daily 7-Book features, identifies exact gate-crossing dates,
and explains why entries happened when they did.
"""

import sys, os
import sqlite3
import numpy as np
import pandas as pd

# Engine imports
ENGINE_SRC = os.path.join(os.path.dirname(__file__), '..', 'engines', 'ichimoku', 'src')
sys.path.insert(0, ENGINE_SRC)
from ichimoku_quant.features import generate_ichimoku_features
from ichimoku_quant.strategy import generate_signals

DB = os.path.join(os.path.dirname(__file__), '..', 'data', 'maftia_quant.db')

WINDOWS = [
    ("April-May 2025", "2025-04-01", "2025-05-25"),
    ("October 2024",   "2024-10-01", "2024-11-10"),
    ("June 2023",      "2023-06-01", "2023-07-15"),
]

# Strategy thresholds (from strategy.py)
T_ENTRY = 0.40
ER_ENTRY = 0.25
ENTROPY_THRESH = 2.271
CONFIRM_ENTRY = 2

def load_and_compute():
    """Load OHLCV from master_ohlcv, compute features + signals."""
    conn = sqlite3.connect(DB)
    df = pd.read_sql("SELECT date, open as Open, high as High, low as Low, close as Close FROM master_ohlcv ORDER BY date", conn)
    conn.close()
    df['date'] = pd.to_datetime(df['date'])
    df.set_index('date', inplace=True)
    for c in ['Open', 'High', 'Low', 'Close']:
        df[c] = df[c].astype(float)
    df = generate_ichimoku_features(df)
    df = generate_signals(df)
    return df

def find_gate_dates(df, start, end):
    """For a window, find the exact date each gate first passed."""
    w = df.loc[start:end].copy()
    if len(w) == 0:
        return w, {}

    cloud_top = np.maximum(w['senkou_span_a'], w['senkou_span_b'])
    cloud_bot = np.minimum(w['senkou_span_a'], w['senkou_span_b'])
    threshold = w['IMO_Std'] * T_ENTRY

    gates = {}

    # Gate 1: Price > Cloud Top
    above_cloud = w['Close'] > cloud_top
    if above_cloud.any():
        gates['price_above_cloud'] = above_cloud.idxmax()
    else:
        gates['price_above_cloud'] = None

    # Gate 2: IMO > Threshold
    imo_pass = w['IMO'] > threshold
    if imo_pass.any():
        gates['imo_above_threshold'] = imo_pass.idxmax()
    else:
        gates['imo_above_threshold'] = None

    # Gate 3: ER > 0.25
    er_pass = w['ER'] > ER_ENTRY
    if er_pass.any():
        gates['er_above_025'] = er_pass.idxmax()
    else:
        gates['er_above_025'] = None

    # Gate 4: Entropy < 2.271
    ent_pass = w['Entropy'] < ENTROPY_THRESH
    if ent_pass.any():
        gates['entropy_below_thresh'] = ent_pass.idxmax()
    else:
        gates['entropy_below_thresh'] = None

    # Gate 5: Not P-Wave chop
    chop_pass = w['wave_type'] != 'P'
    if chop_pass.any():
        gates['not_p_wave'] = chop_pass.idxmax()
    else:
        gates['not_p_wave'] = None

    # First entry in window
    entries = w[w['Pos'] > 0]
    if len(entries) > 0:
        gates['first_entry'] = entries.index[0]
        gates['first_entry_pos'] = entries.iloc[0]['Pos']
        gates['first_entry_regime'] = entries.iloc[0]['Regime']
    else:
        gates['first_entry'] = None

    # Confirmation: find 2-bar consecutive intent
    # Re-trace the confirm_count manually
    confirm = 0
    intent = None
    confirm_dates = []
    for dt, row in w.iterrows():
        imo = row['IMO']
        er = row['ER']
        std = row['IMO_Std']
        entropy = row.get('Entropy', 0.0)
        close = row['Close']
        cloud_a = row['senkou_span_a']
        cloud_b = row['senkou_span_b']
        wave = row.get('wave_type', 'I')
        is_p = row.get('is_p_wave', 0.0)
        chikou = row.get('S_Chikou', 0.0)

        if pd.isna(imo) or pd.isna(er) or pd.isna(std) or pd.isna(entropy):
            intent = None
            confirm = 0
            continue

        cloud_max = np.maximum(cloud_a, cloud_b) if (not pd.isna(cloud_a) and not pd.isna(cloud_b)) else np.nan
        gate_cloud = (close >= cloud_max) if not pd.isna(cloud_max) else True
        gate_chikou = (chikou > 0.0)
        gate_wave = (wave not in ['S', 'Y'])
        threshold_val = std * T_ENTRY
        gate_imo_er = (imo > threshold_val and er > ER_ENTRY and entropy < ENTROPY_THRESH)
        gate_chop = not (is_p == 1.0 and er < 0.35 and imo < 0.20)
        all_gates = gate_cloud and gate_chikou and gate_wave and gate_imo_er and gate_chop

        if all_gates:
            if intent != 1.0:
                intent = 1.0
                confirm = 1
            else:
                confirm += 1
            if confirm >= CONFIRM_ENTRY:
                confirm_dates.append(dt)
        else:
            intent = None
            confirm = 0

    gates['confirm_dates'] = confirm_dates

    return w, gates

def print_window(df, w, gates, label, start, end):
    """Print formatted daily table + gate analysis."""
    cloud_top = np.maximum(w['senkou_span_a'], w['senkou_span_b'])
    cloud_bot = np.minimum(w['senkou_span_a'], w['senkou_span_b'])
    threshold = w['IMO_Std'] * T_ENTRY

    W = 170
    print()
    print("=" * W)
    print(f"  WINDOW: {label} ({start} -> {end})")
    print("=" * W)

    # Header
    hdr = f"  {'Date':<12} {'Close':>10} {'Tenkan':>10} {'Kijun':>10} {'CloudTop':>10} {'CloudBot':>10} {'IMO':>8} {'Std':>7} {'Thresh':>8} {'ER':>7} {'Ent':>6} {'S_Chi':>7} {'Wave':>5} {'Pos':>5} {'Regime':<28}"
    print(hdr)
    print("  " + "-" * (W - 4))

    prev_pos = 0.0
    for dt, row in w.iterrows():
        ct = cloud_top[dt]
        cb = cloud_bot[dt]
        th = threshold[dt]
        pos = row['Pos']
        wave = row.get('wave_type', '?')

        # Mark entry/exit
        marker = ""
        if pos > 0 and prev_pos == 0:
            marker = " <<<< ENTRY"
        elif pos == 0 and prev_pos > 0:
            marker = " <<<< EXIT"
        elif pos != prev_pos and pos > 0:
            marker = " <<<< SIZE CHANGE"

        imo_str = f"{row['IMO']:.4f}" if not pd.isna(row['IMO']) else "N/A"
        std_str = f"{row['IMO_Std']:.4f}" if not pd.isna(row['IMO_Std']) else "N/A"
        th_str = f"{th:.4f}" if not pd.isna(th) else "N/A"
        er_str = f"{row['ER']:.4f}" if not pd.isna(row['ER']) else "N/A"
        ent_str = f"{row['Entropy']:.3f}" if not pd.isna(row.get('Entropy')) else "N/A"
        schi_str = f"{row['S_Chikou']:.4f}" if not pd.isna(row.get('S_Chikou')) else "N/A"

        print(f"  {dt.strftime('%Y-%m-%d'):<12} {row['Close']:>10,.0f} {row['tenkan_sen']:>10,.0f} {row['kijun_sen']:>10,.0f} {ct:>10,.0f} {cb:>10,.0f} {imo_str:>8} {std_str:>7} {th_str:>8} {er_str:>7} {ent_str:>6} {schi_str:>7} {wave:>5} {pos:>5.2f} {row['Regime']:<28}{marker}")
        prev_pos = pos

    # Gate analysis
    print()
    print("  GATE CROSSING DATES:")
    print(f"    Price > Cloud Top:     {gates.get('price_above_cloud', 'N/A')}")
    print(f"    IMO > Threshold:       {gates.get('imo_above_threshold', 'N/A')}")
    print(f"    ER > 0.25:             {gates.get('er_above_025', 'N/A')}")
    print(f"    Entropy < 2.271:       {gates.get('entropy_below_thresh', 'N/A')}")
    print(f"    Not P-Wave:            {gates.get('not_p_wave', 'N/A')}")
    print(f"    2-bar Confirmation:    {gates.get('confirm_dates', [])}")
    print(f"    First Entry:           {gates.get('first_entry', 'NONE in window')}")
    if gates.get('first_entry'):
        print(f"    Entry Position:        {gates.get('first_entry_pos', 0):.2f}x")
        print(f"    Entry Regime:          {gates.get('first_entry_regime', 'N/A')}")

    # Bottleneck analysis
    print()
    print("  BOTTLENECK ANALYSIS:")
    all_dates = []
    for k, v in gates.items():
        if k in ('first_entry', 'first_entry_pos', 'first_entry_regime', 'confirm_dates'):
            continue
        if v is not None:
            all_dates.append((v, k))

    if all_dates:
        all_dates.sort()
        last_gate_date = all_dates[-1][0]
        last_gate_name = all_dates[-1][1]
        print(f"    Last gate to pass: {last_gate_name} on {last_gate_date}")
        if gates.get('first_entry'):
            entry_date = gates['first_entry']
            if last_gate_date <= entry_date:
                days_gap = (entry_date - last_gate_date).days
                print(f"    Entry delay after last gate: {days_gap} days ({CONFIRM_ENTRY}-bar confirmation)")
            else:
                print(f"    WARNING: Entry BEFORE last gate passed!")
    else:
        print("    No gates passed in window.")

    print()

def main():
    print("Loading data and computing 7-Book features...")
    df = load_and_compute()
    print(f"Total bars: {len(df)} [{df.index.min().strftime('%Y-%m-%d')} -> {df.index.max().strftime('%Y-%m-%d')}]")

    for label, start, end in WINDOWS:
        w, gates = find_gate_dates(df, start, end)
        print_window(df, w, gates, label, start, end)

    # Cross-window summary
    print("=" * 170)
    print("  CROSS-WINDOW SUMMARY: WHY EACH ENTRY HAPPENED WHEN IT DID")
    print("=" * 170)
    print()
    for label, start, end in WINDOWS:
        w, gates = find_gate_dates(df, start, end)
        entry = gates.get('first_entry')
        if entry:
            ct = np.maximum(w.loc[entry, 'senkou_span_a'], w.loc[entry, 'senkou_span_b'])
            th = w.loc[entry, 'IMO_Std'] * T_ENTRY
            print(f"  {label}:")
            print(f"    Entry: {entry.strftime('%Y-%m-%d')} @ ${w.loc[entry, 'Close']:,.0f}")
            print(f"    Price vs Cloud Top: ${w.loc[entry, 'Close']:,.0f} vs ${ct:,.0f} ({'ABOVE' if w.loc[entry, 'Close'] > ct else 'BELOW'})")
            print(f"    IMO: {w.loc[entry, 'IMO']:.4f} vs Threshold: {th:.4f}")
            print(f"    ER: {w.loc[entry, 'ER']:.4f} vs 0.25")
            print(f"    Entropy: {w.loc[entry, 'Entropy']:.3f} vs 2.271")
            print(f"    Wave: {w.loc[entry, 'wave_type']}")
            print(f"    S_Chikou: {w.loc[entry, 'S_Chikou']:.4f}")
            print(f"    Position: {w.loc[entry, 'Pos']:.2f}x | Regime: {w.loc[entry, 'Regime']}")
            # Find which gate was last
            gate_dates = []
            for k, v in gates.items():
                if k in ('first_entry', 'first_entry_pos', 'first_entry_regime', 'confirm_dates'):
                    continue
                if v is not None:
                    gate_dates.append((v, k))
            if gate_dates:
                gate_dates.sort()
                last = gate_dates[-1]
                print(f"    Bottleneck gate: {last[1]} (passed {last[0].strftime('%Y-%m-%d')})")
            print()
        else:
            print(f"  {label}: NO ENTRY in window")
            print()

    print("Done.")

if __name__ == "__main__":
    main()
