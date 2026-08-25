#!/usr/bin/env python3
"""
V2 harness: Use actual BacktestRunner for code-sensitive measurement
Falls back to DB recomputed if runner fails
"""
import os, sys, statistics, math
from datetime import datetime
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LTTD_SRC = os.path.join(BASE, "engines", "lttd")
if LTTD_SRC not in sys.path:
    sys.path.insert(0, LTTD_SRC)
DB_PATH = os.path.join(BASE, "data", "maftia_quant.db")
START="2016-01-01"
END="2026-08-25"
FEE=10

def fallback():
    # Use previous logic (imported)
    import importlib.util, pathlib
    spec = importlib.util.spec_from_file_location("bench", os.path.join(BASE, "scripts", "autoresearch_lttd_benchmark.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    mod.main()

def main():
    try:
        import pandas as pd
        import sqlite3
        from src.backtest.runner import BacktestRunner
        # Load master_ohlcv
        con = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
        df = pd.read_sql_query("SELECT date as time, open, high, low, close, volume FROM master_ohlcv WHERE date BETWEEN ? AND ? ORDER BY date ASC", con, params=(START, END))
        con.close()
        if df.empty:
            raise ValueError("no data")
        df['time'] = pd.to_datetime(df['time'])
        df = df.set_index('time').sort_index()
        # Ensure sufficient history: need 2016 onwards for 1095 window? Fetch earlier
        con = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
        df_full = pd.read_sql_query("SELECT date as time, open, high, low, close, volume FROM master_ohlcv WHERE date <= ? ORDER BY date ASC", con, params=(END,))
        con.close()
        df_full['time'] = pd.to_datetime(df_full['time'])
        df_full = df_full.set_index('time').sort_index()
        # Use df_full for training but evaluate only 2018-2024
        runner = BacktestRunner(ensemble_mode="pca_consensus")
        res = runner.run(df_full)
        # res contains results_df indexed by date
        results_df = res['results']
        # Filter to 2018-2024
        mask = (results_df.index >= START) & (results_df.index <= END)
        df_eval = results_df[mask]
        # Compute trades from target_exposure
        trades=[]
        prev=0
        entry_price=None
        entry_date=None
        for date, row in df_eval.iterrows():
            exp = float(row.get('target_exposure', 0) or 0)
            close = float(row.get('close', 0) or 0)
            exp_val = 1.0 if exp>0.5 else 0.0
            date_str = pd.Timestamp(date).strftime("%Y-%m-%d")
            if exp_val>0 and prev==0:
                entry_price=close
                entry_date=date_str
            elif exp_val==0 and prev>0 and entry_price is not None:
                exit_price=close
                gross=(exit_price-entry_price)/entry_price*100 if entry_price else 0
                hold=(pd.Timestamp(date_str)-pd.Timestamp(entry_date)).days
                trades.append((entry_date,date_str,gross,hold))
            prev=exp_val
        total=len(trades)
        wins=sum(1 for _,_,g,_ in trades if g>0)
        winRate=wins/total*100 if total else 0
        gross_profit=sum(g for _,_,g,_ in trades if g>0)
        gross_loss=sum(abs(g) for _,_,g,_ in trades if g<=0)
        pf=gross_profit/gross_loss if gross_loss else 999
        holds=[h for _,_,_,h in trades]
        holdMedian=int(statistics.median(holds)) if holds else 0
        holdAvg=sum(holds)/len(holds) if holds else 0
        years=(pd.Timestamp(END)-pd.Timestamp(START)).days/365.25
        tpy=total/years if years else 0
        # Sharpe from runner
        sharpe=res['metrics'].get('annualized_sharpe',0)
        exp_gross=sum(g for _,_,g,_ in trades)/total if total else 0
        print(f"METRIC winRate={winRate:.4f}")
        print(f"METRIC profitFactor={pf:.4f}")
        print(f"METRIC totalTrades={total}")
        print(f"METRIC tradesPerYear={tpy:.4f}")
        print(f"METRIC holdMedianDays={holdMedian}")
        print(f"METRIC holdAvgDays={holdAvg:.2f}")
        print(f"METRIC expectancyGrossPct={exp_gross:.4f}")
        print(f"METRIC expectancyNetPct={exp_gross - (FEE/10000*100*2):.4f}")
        print(f"METRIC sharpeNet={sharpe:.4f}")
        return 0
    except Exception as e:
        import traceback
        print(f"V2 failed {e}, traceback:", file=sys.stderr)
        traceback.print_exc()
        print("FALLBACK to V1", file=sys.stderr)
        # fallback to V1 script
        os.execv(sys.executable, [sys.executable, os.path.join(BASE, "scripts", "autoresearch_lttd_benchmark.py")])

if __name__=="__main__":
    sys.exit(main())
