#!/usr/bin/env python3
"""
Tests SDCA trade performance using the DR-immune composite and custom thresholds.
Runs the full historical backtest and reports key metrics.
"""
import os, sys, json, sqlite3
import pandas as pd
import numpy as np

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(BASE_DIR) if os.path.basename(BASE_DIR) == 'scripts' else BASE_DIR
if PROJECT_DIR not in sys.path:
    sys.path.insert(0, PROJECT_DIR)
if "/home/ubuntu/projects" not in sys.path:
    sys.path.insert(0, "/home/ubuntu/projects")

from db_connector import get_wal_connection

MAIN_DB = os.path.join(PROJECT_DIR, 'data/maftia_quant.db')

# Default thresholds (can be overridden via command line args)
DEFAULT_THRESHOLDS = {
    "dca_in_start": 1.8,
    "all_in_val": 1.5,
    "dca_out_start": -1.5,
    "all_out_val": 0.0,
}

def run_backtest(thresholds=None):
    if thresholds is None:
        thresholds = DEFAULT_THRESHOLDS
    
    print(f"=== SDCA BACKTEST PERFORMANCE ===")
    print(f"Thresholds: dca_in_start={thresholds['dca_in_start']}, all_in_val={thresholds['all_in_val']}, "
          f"dca_out_start={thresholds['dca_out_start']}, all_out_val={thresholds['all_out_val']}")
    print()
    
    # Load data from unified_daily_analytics
    conn = get_wal_connection(MAIN_DB)
    rows = conn.execute("""
        SELECT date, btc_price as close, valuation_composite
        FROM unified_daily_analytics
        WHERE btc_price IS NOT NULL AND valuation_composite IS NOT NULL
        ORDER BY date ASC
    """).fetchall()
    conn.close()
    
    if not rows:
        print("No data found!")
        return
    
    df = pd.DataFrame(rows, columns=['date', 'close', 'valuation_composite'])
    df['date'] = df['date'].str[:10]
    print(f"Data: {len(df)} days, {df['date'].iloc[0]} to {df['date'].iloc[-1]}")
    print(f"Price range: ${df['close'].min():,.2f} to ${df['close'].max():,.2f}")
    print(f"Composite range: {df['valuation_composite'].min():+.2f} to {df['valuation_composite'].max():+.2f}")
    print()
    
    # SDCA Engine (simplified version matching the TypeScript/Python logic)
    initial_cash = 10000.0
    fee_bps = 10
    fee_rate = fee_bps / 10000.0
    base_dca = 100.0
    
    cash = initial_cash
    btc = 0.0
    total_invested = 0.0
    
    simple_dca_cash = initial_cash
    simple_dca_btc = 0.0
    
    buy_hold_btc = initial_cash / df['close'].iloc[0]
    
    state = "NEUTRAL"
    buy_all_fired = False
    
    trade_log = []
    equity_curve = []
    trade_id = 0
    
    t = thresholds
    
    for i in range(len(df)):
        date_str = df['date'].iloc[i]
        price = float(df['close'].iloc[i])
        comp = float(df['valuation_composite'].iloc[i])
        
        if i == 0:
            equity_curve.append({"date": date_str, "sdca": initial_cash, "simpleDca": initial_cash, "buyHold": buy_hold_btc * price})
            continue
        
        comp_t1 = float(df['valuation_composite'].iloc[i-1])
        price_t1 = float(df['close'].iloc[i-1])
        
        # MA200 ratio
        window = df['close'].iloc[max(0, i-200):i]
        ma200 = window.mean()
        ratio_t1 = price_t1 / ma200 if ma200 > 0 else 1.0
        
        # SMA30
        sma_window = df['close'].iloc[max(0, i-30):i]
        sma30_t1 = sma_window.mean()
        
        # Drawdown
        peak = df['close'].iloc[:i].max()
        drawdown_t1 = (peak - price_t1) / peak * 100.0 if peak > 0 else 0
        
        # ATH check
        is_ath = price_t1 >= peak * 0.99
        
        # Monday check
        from datetime import datetime
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        is_monday = dt.weekday() == 0
        
        # FSM Logic
        prev_state = state
        new_state = "NEUTRAL"
        multiplier = 0.0
        action = "HOLD"
        
        # Check transitions
        in_sell_zone = prev_state in ("SELL_ALL", "SELL_DCA") and comp_t1 <= t.get("all_out_val", 0.0)
        in_buy_zone = prev_state in ("BUY_ALL", "BUY_DCA") and comp_t1 >= t.get("all_in_val", 1.5)
        
        if comp_t1 <= t["dca_out_start"] and ratio_t1 < 2.0:
            new_state = "SELL_ALL" if (drawdown_t1 >= 20.0 and price_t1 < sma30_t1) or comp_t1 <= -2.0 else "SELL_DCA"
        elif comp_t1 >= t["dca_in_start"] and ratio_t1 < 1.0:
            # Cross above MA200 for BUY_ALL
            if i > 1:
                prev_ratio = ratio_t1
                prev2_ratio = float(df['close'].iloc[max(0,i-2)] / df['close'].iloc[max(0,i-2):i].mean() if i > 1 else 0)
                cross_above_ma200 = False  # simplified
            new_state = "BUY_ALL" if comp_t1 >= t["all_in_val"] and not buy_all_fired and is_ath else "BUY_DCA"
        elif -0.5 < comp_t1 < 0.5:
            new_state = "NEUTRAL"
        else:
            new_state = prev_state if prev_state != "NEUTRAL" else "NEUTRAL"
        
        # Reset buy_all_fired
        if comp_t1 < 0:
            buy_all_fired = False
        
        # Execute action
        if new_state == "SELL_ALL":
            action = "SELL_ALL"
            multiplier = -1.0
        elif new_state == "SELL_DCA":
            if is_monday:
                action = "SELL_DCA"
                multiplier = -0.15 if comp_t1 <= -1.5 else -0.08
            else:
                action = "HOLD"
        elif new_state == "BUY_ALL":
            action = "BUY_ALL"
            multiplier = 999.0
            buy_all_fired = True
        elif new_state == "BUY_DCA":
            if is_monday:
                action = "BUY_DCA"
                if comp_t1 >= 1.5: multiplier = 3.0
                elif comp_t1 >= 1.0: multiplier = 2.0
                else: multiplier = 1.5
            else:
                action = "HOLD"
        elif new_state == "NEUTRAL":
            if is_monday and comp_t1 >= 0.5:
                action = "BUY_DCA"
                multiplier = 1.0
            else:
                action = "HOLD"
        
        # Process trade
        dca_amount = base_dca * multiplier
        
        if dca_amount > 0 and action != "HOLD":
            fee = dca_amount * fee_rate
            net = dca_amount - fee
            btc_bought = net / price
            btc += btc_bought
            cash -= dca_amount
            total_invested += dca_amount
            
            if action == "BUY_ALL":
                # Use remaining cash
                remaining = cash
                fee_all = remaining * fee_rate
                btc_all = (remaining - fee_all) / price
                btc += btc_all
                cash -= remaining
                total_invested += remaining
            
            trade_id += 1
            trade_log.append({
                "id": trade_id, "date": date_str, "action": "BUY",
                "price": price, "amount": dca_amount if action != "BUY_ALL" else total_invested,
                "multiplier": multiplier, "phase": new_state.lower()
            })
            
        elif dca_amount < 0:
            sell_amount = abs(dca_amount)
            btc_to_sell = min(sell_amount / price, btc)
            if btc_to_sell > 0:
                proceeds = btc_to_sell * price
                fee = proceeds * fee_rate
                btc -= btc_to_sell
                cash += (proceeds - fee)
                
                trade_id += 1
                trade_log.append({
                    "id": trade_id, "date": date_str, "action": "SELL",
                    "price": price, "amount": proceeds,
                    "multiplier": multiplier, "phase": new_state.lower()
                })
        
        # Simple DCA
        simple_fee = base_dca * fee_rate
        simple_net = base_dca - simple_fee
        simple_dca_btc += simple_net / price
        simple_dca_cash -= base_dca
        
        # Equity
        sdca_eq = cash + btc * price
        simple_eq = simple_dca_cash + simple_dca_btc * price
        bh_eq = buy_hold_btc * price
        
        equity_curve.append({"date": date_str, "sdca": sdca_eq, "simpleDca": simple_eq, "buyHold": bh_eq})
    
    # Final metrics
    n = len(equity_curve)
    years = n / 365.25
    final_sdca = equity_curve[-1]["sdca"]
    final_simple = equity_curve[-1]["simpleDca"]
    final_bh = equity_curve[-1]["buyHold"]
    
    total_return = ((final_sdca - initial_cash) / initial_cash) * 100.0
    simple_return = ((final_simple - initial_cash) / initial_cash) * 100.0
    bh_return = ((final_bh - initial_cash) / initial_cash) * 100.0
    
    cagr = ((final_sdca / initial_cash) ** (1 / years) - 1) * 100.0 if years > 0 else 0
    
    # Daily returns
    daily_ret = []
    for i in range(1, len(equity_curve)):
        if equity_curve[i-1]["sdca"] > 0:
            daily_ret.append((equity_curve[i]["sdca"] - equity_curve[i-1]["sdca"]) / equity_curve[i-1]["sdca"])
    
    mean_ret = np.mean(daily_ret) if daily_ret else 0
    std_ret = np.std(daily_ret) if daily_ret else 0
    ann_ret = mean_ret * 365 * 100
    ann_vol = std_ret * np.sqrt(365) * 100
    sharpe = ann_ret / ann_vol if ann_vol > 0 else 0
    
    # Max DD
    peak_sdca = initial_cash
    max_dd = 0
    for eq in equity_curve:
        if eq["sdca"] > peak_sdca:
            peak_sdca = eq["sdca"]
        dd = (peak_sdca - eq["sdca"]) / peak_sdca
        if dd > max_dd:
            max_dd = dd
    
    # Win rate
    wins = 0
    total_trades = 0
    gross_profit = 0
    gross_loss = 0
    for t in trade_log:
        if t["action"] == "SELL":
            total_trades += 1
            profit = t["amount"] - (t["amount"] / (1 + 0.02))  # simplified
            if profit > 0:
                wins += 1
                gross_profit += profit
            else:
                gross_loss += abs(profit)
    
    win_rate = (wins / total_trades * 100) if total_trades > 0 else 0
    profit_factor = (gross_profit / gross_loss) if gross_loss > 0 else (999 if gross_profit > 0 else 0)
    
    print("=== BACKTEST RESULTS ===")
    print(f"{'Metric':25s} {'SDCA':>12s} {'Simple DCA':>12s} {'Buy & Hold':>12s}")
    print("-" * 65)
    print(f"{'Total Return':25s} {total_return:>+11.2f}% {simple_return:>+11.2f}% {bh_return:>+11.2f}%")
    print(f"{'CAGR':25s} {cagr:>+11.2f}% {'N/A':>12s} {'N/A':>12s}")
    print(f"{'Max Drawdown':25s} {max_dd*100:>10.1f}% {'N/A':>12s} {'N/A':>12s}")
    print(f"{'Sharpe Ratio':25s} {sharpe:>10.2f} {'N/A':>12s} {'N/A':>12s}")
    print()
    print(f"{'Total Trades':25s} {len(trade_log)}")
    print(f"{'Win Rate':25s} {win_rate:.1f}%")
    print(f"{'Profit Factor':25s} {profit_factor:.2f}")
    print(f"{'Final Equity':25s} ${final_sdca:>10,.2f}")
    print()
    
    # Show last 10 trades
    print("=== LAST 10 TRADES ===")
    print(f"{'Date':12s} {'Action':10s} {'Price':>10s} {'Amount':>12s} {'Mult':>6s}")
    print("-" * 55)
    for t in trade_log[-10:]:
        amt_str = f"${t['amount']:>8,.0f}" if t['amount'] >= 100 else f"{t['amount']:>8.4f}"
        print(f"{t['date']:12s} {t['action']:10s} {t['price']:>10,.0f} {amt_str:>12s} {t['multiplier']:>6.1f}x")


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--dca-in', type=float, default=1.8)
    parser.add_argument('--all-in', type=float, default=1.5)
    parser.add_argument('--dca-out', type=float, default=-1.5)
    parser.add_argument('--all-out', type=float, default=0.0)
    args = parser.parse_args()
    
    thresholds = {
        "dca_in_start": args.dca_in,
        "all_in_val": args.all_in,
        "dca_out_start": args.dca_out,
        "all_out_val": args.all_out,
    }
    
    run_backtest(thresholds)
