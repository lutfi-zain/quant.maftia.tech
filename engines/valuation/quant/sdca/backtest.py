import math
from typing import List, Dict, Any, Optional
from .engine import (
    DailyRecord, 
    compute_sdca_signals,
    merge_thresholds
)

# --- Backtest Computation ---

def compute_sdca_backtest(data: List[DailyRecord], config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Run SDCA backtest over daily data.
    """
    fee_bps = config.get("fee_bps", 10)
    base_dca_amount = config.get("base_dca_amount", 100.0)
    initial_cash = config.get("initial_cash", 10000.0)
    fee_rate = fee_bps / 10000.0
    
    thresholds = merge_thresholds(config.get("thresholds"))
    signals = compute_sdca_signals(data, thresholds)
    
    # State tracking
    sdca_btc = 0.0
    sdca_cash = initial_cash
    sdca_total_invested = 0.0
    
    simple_dca_cash = initial_cash
    simple_dca_btc = 0.0
    
    buy_hold_start_price = data[0].close if data else 1.0
    if buy_hold_start_price <= 0:
        buy_hold_start_price = 1.0
    buy_hold_btc = initial_cash / buy_hold_start_price
    
    # Metrics tracking
    peak_sdca = initial_cash
    max_drawdown = 0.0
    total_fees = 0.0
    wins = 0
    total_trades = 0
    gross_profit = 0.0
    gross_loss = 0.0
    
    equity_curve = []
    trade_log = []
    trade_id = 0
    
    for i, day in enumerate(data):
        signal = signals[i]
        price = day.close
        
        if price <= 0:
            continue
            
        multiplier = signal["multiplier"]
        sdca_amount = base_dca_amount * multiplier
        
        if sdca_amount > 0:
            # Buy
            fee = sdca_amount * fee_rate
            net_amount = sdca_amount - fee
            btc_bought = net_amount / price
            
            sdca_btc += btc_bought
            sdca_cash -= sdca_amount
            sdca_total_invested += sdca_amount
            total_fees += fee
            
            trade_id += 1
            trade_log.append({
                "id": trade_id,
                "date": day.date,
                "action": "BUY",
                "amount_usd": sdca_amount,
                "btc_price": price,
                "multiplier": multiplier,
                "phase": signal["phase"]
            })
            total_trades += 1
            
        elif sdca_amount < 0:
            # Sell
            sell_amount = abs(sdca_amount)
            btc_to_sell = min(sell_amount / price, sdca_btc)
            
            if btc_to_sell > 0:
                proceeds = btc_to_sell * price
                fee = proceeds * fee_rate
                
                sdca_btc -= btc_to_sell
                sdca_cash += (proceeds - fee)
                total_fees += fee
                
                return_pct = 0.0
                if sdca_total_invested > 0:
                    return_pct = ((proceeds - fee - sell_amount) / sell_amount) * 100.0
                    
                if return_pct > 0:
                    wins += 1
                    gross_profit += return_pct
                else:
                    gross_loss += abs(return_pct)
                    
                trade_id += 1
                trade_log.append({
                    "id": trade_id,
                    "date": day.date,
                    "action": "SELL",
                    "amount_usd": proceeds,
                    "btc_price": price,
                    "multiplier": multiplier,
                    "phase": signal["phase"],
                    "profit_pct": round(return_pct, 2)
                })
                total_trades += 1
                
        # Simple DCA
        simple_fee = base_dca_amount * fee_rate
        simple_net = base_dca_amount - simple_fee
        simple_dca_btc += simple_net / price
        simple_dca_cash -= base_dca_amount
        
        # Equity values
        sdca_equity = sdca_cash + sdca_btc * price
        simple_dca_equity = simple_dca_cash + simple_dca_btc * price
        buy_hold_equity = buy_hold_btc * price
        
        equity_curve.append({
            "date": day.date,
            "sdca": sdca_equity,
            "simpleDca": simple_dca_equity,
            "buyHold": buy_hold_equity
        })
        
        if sdca_equity > peak_sdca:
            peak_sdca = sdca_equity
            
        dd = (peak_sdca - sdca_equity) / peak_sdca if peak_sdca > 0 else 0
        if dd > max_drawdown:
            max_drawdown = dd
            
    # Final metrics
    n = len(data)
    years = n / 365.25
    final_sdca_equity = equity_curve[-1]["sdca"] if equity_curve else initial_cash
    
    total_return = ((final_sdca_equity - initial_cash) / initial_cash) * 100.0 if initial_cash > 0 else 0
    
    cagr = 0.0
    if years > 0 and final_sdca_equity > 0 and initial_cash > 0:
        cagr = ((final_sdca_equity / initial_cash) ** (1 / years) - 1) * 100.0
        
    # Daily returns for volatility/sharpe
    daily_returns = []
    for i in range(1, len(equity_curve)):
        prev = equity_curve[i-1]["sdca"]
        curr = equity_curve[i]["sdca"]
        if prev > 0:
            daily_returns.append((curr - prev) / prev)
            
    mean_return = sum(daily_returns) / len(daily_returns) if daily_returns else 0.0
    
    variance = 0.0
    if daily_returns:
        variance = sum((r - mean_return) ** 2 for r in daily_returns) / len(daily_returns)
        
    annualized_volatility = math.sqrt(variance) * math.sqrt(365) * 100.0
    annualized_return = mean_return * 365 * 100.0
    
    sharpe_ratio = annualized_return / annualized_volatility if annualized_volatility > 0 else 0.0
    
    negative_returns = [r for r in daily_returns if r < 0]
    downside_variance = sum(r ** 2 for r in negative_returns) / len(daily_returns) if daily_returns else 0.0
    sortino_ratio = (mean_return * 365) / (math.sqrt(downside_variance) * math.sqrt(365)) if downside_variance > 0 else 0.0
    
    profit_factor = gross_profit / gross_loss if gross_loss > 0 else (999.0 if gross_profit > 0 else 0.0)
    win_rate = (wins / total_trades) * 100.0 if total_trades > 0 else 0.0
    
    # Ensure thresholds match the expected output format of typescript exactly
    return {
        "metrics": {
            "sharpeRatio": round(sharpe_ratio, 2),
            "totalReturn": round(total_return, 2),
            "maxDrawdown": round(max_drawdown * 100, 1),
            "annualizedReturn": round(annualized_return, 2),
            "annualizedVolatility": round(annualized_volatility, 2),
            "winRate": round(win_rate, 2),
            "profitFactor": round(profit_factor, 2),
            "totalTrades": total_trades,
            "sortinoRatio": round(sortino_ratio, 2),
            "cagr": round(cagr, 2)
        },
        "equity_curve": equity_curve,
        "trade_log": trade_log,
        "signals": signals,
        "config": config,
        "thresholds": thresholds
    }
