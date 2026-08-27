#!/usr/bin/env python3
"""
Diagnose 4 anomaly windows in the Ichimoku + consensus quant engine.
Extracts daily price, IMO, Chikou, wave type, regime, active position,
and flags position changes with reasons.
"""

import sqlite3
import os

DB = os.path.join(os.path.dirname(__file__), "..", "data", "maftia_quant.db")

WINDOWS = [
    ("Peak 2017 / Early 2018 Bear",          "2017-12-15", "2018-02-15"),
    ("Pre-Covid to Post-Covid Crash",         "2020-02-15", "2020-03-31"),
    ("April 2022 Dead-Cat Bounce / Bear",     "2022-03-15", "2022-05-15"),
    ("Late 2025 Top / Distribution",          "2025-09-15", "2025-11-15"),
]

COLS = [
    "date",
    "btc_price",
    "ichimoku_imo",          # Ichimoku Intelligent Market Outlook
    "ichi_chikou",           # Chikou span (close shifted back)
    "ichi_wave_type",        # Impulse / Correction / etc.
    "lttd_regime",           # Long-Term Trend Detection regime
    "ichimoku_regime",       # Ichimoku-derived regime
    "ichimoku_position",     # Ichimoku pillar position [0,1]
    "ichi_active_pos",       # Active position after risk overlay
    "mttd_position",         # Medium-Term Trend Detection position
    "ichi_s_chikou",         # Chikou signal vs cloud
    "ichi_s_cloud",          # Cloud signal
    "ichi_s_future",         # Future cloud signal
    "ichi_s_tk",             # Tenkan/Kijun cross signal
    "ichi_kairitsu",         # Deviation from equilibrium
    "ichi_cloud_thickness",  # Cloud thickness
    "ichi_imo_std",          # IMO standard deviation
    "ichi_entropy",          # Entropy measure
    "ichi_er",               # Efficiency ratio
    "lttd_circuit_breaker",  # Circuit breaker flag
    "lttd_exposure",         # LTTD exposure
    "consensus_score",       # Consensus score
    "consensus_exposure",    # Consensus exposure
    "sdca_phase",            # SDCA phase
    "sdca_action",           # SDCA action
]

CHANGE_SIGNALS = [
    "ichimoku_position",
    "ichi_active_pos",
    "ichimoku_regime",
    "lttd_regime",
    "ichi_wave_type",
    "ichimoku_imo",
]

def main():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    for label, d0, d1 in WINDOWS:
        print("=" * 110)
        print(f"  WINDOW: {label}  ({d0} → {d1})")
        print("=" * 110)

        cur.execute(
            f"SELECT {', '.join(COLS)} FROM unified_daily_analytics "
            f"WHERE date >= ? AND date <= ? ORDER BY date",
            (d0, d1),
        )
        rows = [dict(r) for r in cur.fetchall()]

        if not rows:
            print("  *** NO DATA in this window ***\n")
            continue

        # ── Print header ──
        hdr = (
            f"{'Date':>10}  {'Price':>10}  {'IMO':>7}  {'Chikou':>9}  "
            f"{'Wave':>10}  {'Regime':>10}  {'IchiPos':>7}  {'ActPos':>7}  "
            f"{'MtdPos':>7}  {'T/K':>4}  {'S_Cloud':>7}  {'S_Futr':>7}  "
            f"{'S_Chi':>6}  {'Kairitsu':>8}  {'ClThick':>8}  "
            f"{'Entropy':>7}  {'ER':>6}  {'CBrk':>4}  {'ConsSc':>6}  "
            f"{'ConsExp':>7}  {'SDCA':>6}"
        )
        print(f"  {hdr}")
        print("  " + "-" * 108)

        prev = None
        change_events = []

        for row in rows:
            def fmt(v, w=7, nd=2):
                if v is None:
                    return " " * w + "."
                if isinstance(v, float):
                    return f"{v:>{w}.{nd}f}"
                s = str(v)
                return s[:w].rjust(w)

            price_s = fmt(row["btc_price"], 10, 0)
            imo_s = fmt(row["ichimoku_imo"], 7, 3)
            chi_s = fmt(row["ichi_chikou"], 9, 2)
            wave_s = (row["ichi_wave_type"] or "—")[:10].rjust(10)
            reg_s = (row["ichimoku_regime"] or "—")[:10].rjust(10)
            ipos_s = fmt(row["ichimoku_position"], 7, 4)
            apos_s = fmt(row["ichi_active_pos"], 7, 4)
            mpos_s = fmt(row["mttd_position"], 7, 4)
            tk_s = fmt(row["ichi_s_tk"], 4, 0)
            sc_s = fmt(row["ichi_s_cloud"], 7, 3)
            sf_s = fmt(row["ichi_s_future"], 7, 3)
            schi_s = fmt(row["ichi_s_chikou"], 6, 1)
            kair_s = fmt(row["ichi_kairitsu"], 8, 4)
            cth_s = fmt(row["ichi_cloud_thickness"], 8, 2)
            ent_s = fmt(row["ichi_entropy"], 7, 3)
            er_s = fmt(row["ichi_er"], 6, 4)
            cb_s = fmt(row["lttd_circuit_breaker"], 4, 0)
            cs_s = fmt(row["consensus_score"], 6, 3)
            ce_s = fmt(row["consensus_exposure"], 7, 4)
            sdca_s = (row["sdca_phase"] or "—")[:6].rjust(6)

            line = (
                f"  {row['date']:>10}  {price_s}  {imo_s}  {chi_s}  "
                f"{wave_s}  {reg_s}  {ipos_s}  {apos_s}  "
                f"{mpos_s}  {tk_s}  {sc_s}  {sf_s}  "
                f"{schi_s}  {kair_s}  {cth_s}  "
                f"{ent_s}  {er_s}  {cb_s}  {cs_s}  "
                f"{ce_s}  {sdca_s}"
            )
            print(line)

            # ── Detect position changes vs previous day ──
            if prev is not None:
                reasons = []
                for col in CHANGE_SIGNALS:
                    old, new = prev.get(col), row.get(col)
                    if old != new and (old is not None or new is not None):
                        reasons.append(f"{col}: {old} → {new}")

                # Also flag when active position crosses zero
                old_ap = prev.get("ichi_active_pos")
                new_ap = row.get("ichi_active_pos")
                if old_ap is not None and new_ap is not None:
                    if (old_ap <= 0 < new_ap) or (old_ap > 0 >= new_ap):
                        reasons.append(
                            f"*** POSITION FLIP: {old_ap:.4f} → {new_ap:.4f} "
                            f"({'LONG ENTRY' if new_ap > 0 else 'LONG EXIT / SHORT'})"
                        )

                # Flag IMO sign change
                old_imo = prev.get("ichimoku_imo")
                new_imo = row.get("ichimoku_imo")
                if old_imo is not None and new_imo is not None:
                    if (old_imo < 0 <= new_imo) or (old_imo >= 0 > new_imo):
                        reasons.append(
                            f"*** IMO CROSSOVER: {old_imo:.3f} → {new_imo:.3f}"
                        )

                # Flag regime change
                old_reg = prev.get("ichimoku_regime")
                new_reg = row.get("ichimoku_regime")
                if old_reg != new_reg:
                    reasons.append(
                        f"*** REGIME CHANGE: {old_reg} → {new_reg}"
                    )

                if reasons:
                    change_events.append((row["date"], row["btc_price"], reasons))

            prev = row

        # ── Print change events summary ──
        if change_events:
            print()
            print(f"  {'─' * 80}")
            print(f"  POSITION / REGIME CHANGE EVENTS ({len(change_events)} total)")
            print(f"  {'─' * 80}")
            for date, price, reasons in change_events:
                print(f"  {date}  BTC=${price:,.0f}")
                for r in reasons:
                    print(f"      → {r}")
        else:
            print("\n  (No position or regime changes detected in this window)")

        # ── Key summary stats ──
        prices = [r["btc_price"] for r in rows if r["btc_price"] is not None]
        imos = [r["ichimoku_imo"] for r in rows if r["ichimoku_imo"] is not None]
        aps = [r["ichi_active_pos"] for r in rows if r["ichi_active_pos"] is not None]
        regimes = set(r["ichimoku_regime"] for r in rows if r["ichimoku_regime"])
        waves = set(r["ichi_wave_type"] for r in rows if r["ichi_wave_type"])

        print()
        print(f"  SUMMARY for {label}:")
        if prices:
            print(f"    Price:  {min(prices):,.0f} – {max(prices):,.0f}  "
                  f"(Δ {(max(prices)-min(prices))/min(prices)*100:.1f}%)")
        if imos:
            print(f"    IMO:    {min(imos):.3f} – {max(imos):.3f}  "
                  f"(mean={sum(imos)/len(imos):.3f})")
        if aps:
            print(f"    ActPos: {min(aps):.4f} – {max(aps):.4f}  "
                  f"(mean={sum(aps)/len(aps):.4f})")
        print(f"    Regimes observed: {', '.join(sorted(regimes))}")
        print(f"    Wave types:       {', '.join(sorted(waves))}")
        print()

    conn.close()
    print("Done.")

if __name__ == "__main__":
    main()
