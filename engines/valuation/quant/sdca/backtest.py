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
    Run SDCA backtest over daily data matching TypeScript src/lib/sdcaBacktest.ts exactly.
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
    weighted_cost_basis_usd = 0.0
    
    simple_dca_cash = initial_cash
    simple_dca_btc = 0.0
    
    buy_hold_start_price = data[0].close if data else 1.0
    if buy_hold_start_price <= 0:
        buy_hold_start_price = 1.0
    buy_hold_btc = initial_cash / buy_hold_start_price
    
    # Metrics tracking
    peak_sdca = initial_cash
    peak_market = initial_cash
    max_drawdown = 0.0
    max_drawdown_market = 0.0
    total_fees = 0.0
    wins = 0
    losses = 0
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
        
        if multiplier == 999.0:
            # ALL IN: Allocate 100% remaining cash to BTC
            if sdca_cash > 0:
                alloc_amount = sdca_cash
                fee = alloc_amount * fee_rate
                net_amount = alloc_amount - fee
                btc_bought = net_amount / price
                sdca_btc += btc_bought
                sdca_cash = 0.0
                sdca_total_invested += alloc_amount
                weighted_cost_basis_usd += alloc_amount
                total_fees += fee
                
                trade_id += 1
                trade_log.append({
                    "id": trade_id,
                    "date": day.date,
                    "action": "ALL_IN",
                    "amount_usd": alloc_amount,
                    "btc_price": price,
                    "multiplier": multiplier,
                    "phase": signal["phase"],
                    "net_pnl_usd": 0.0,
                    "profit_pct": 0.0
                })
                total_trades += 1
                
        elif multiplier == -1.0:
            # ALL OUT: Sell 100% remaining BTC position to cash
            if sdca_btc > 0:
                btc_to_sell = sdca_btc
                proceeds = btc_to_sell * price
                fee = proceeds * fee_rate
                net_proceeds = proceeds - fee
                cost_of_sold_btc = weighted_cost_basis_usd if weighted_cost_basis_usd > 0 else sdca_total_invested
                net_pnl_usd = net_proceeds - cost_of_sold_btc
                return_pct = (net_pnl_usd / cost_of_sold_btc) * 100.0 if cost_of_sold_btc > 0 else 0.0
                
                if net_pnl_usd >= 0:
                    wins += 1
                    gross_profit += net_pnl_usd
                else:
                    losses += 1
                    gross_loss += abs(net_pnl_usd)
                    
                sdca_btc = 0.0
                sdca_cash += net_proceeds
                weighted_cost_basis_usd = 0.0
                total_fees += fee
                
                trade_id += 1
                trade_log.append({
                    "id": trade_id,
                    "date": day.date,
                    "action": "ALL_OUT",
                    "amount_usd": net_proceeds,
                    "btc_price": price,
                    "multiplier": multiplier,
                    "phase": signal["phase"],
                    "net_pnl_usd": round(net_pnl_usd, 2),
                    "profit_pct": round(return_pct, 2)
                })
                total_trades += 1
                
        elif sdca_amount > 0:
            # Proportional Buy DCA (7% base cash deployment per Monday)
            dca_cash_pct = config.get("dca_cash_pct", 0.07)
            target_amount = sdca_cash * min(1.0, dca_cash_pct * multiplier)
            amount_to_buy = min(sdca_cash, max(base_dca_amount, target_amount))
            if amount_to_buy > 0:
                fee = amount_to_buy * fee_rate
                net_amount = amount_to_buy - fee
                btc_bought = net_amount / price
                sdca_btc += btc_bought
                sdca_cash -= amount_to_buy
                sdca_total_invested += amount_to_buy
                weighted_cost_basis_usd += amount_to_buy
                total_fees += fee
                
                trade_id += 1
                trade_log.append({
                    "id": trade_id,
                    "date": day.date,
                    "action": "BUY",
                    "amount_usd": round(amount_to_buy, 2),
                    "btc_price": price,
                    "multiplier": multiplier,
                    "phase": signal["phase"],
                    "net_pnl_usd": 0.0,
                    "profit_pct": 0.0
                })
                total_trades += 1
                
        elif sdca_amount < 0:
            # Sell DCA (19% position trimming in DCA_OUT)
            dca_sell_frac = config.get("dca_sell_frac", 0.19)
            sell_btc = sdca_btc * dca_sell_frac
            if sell_btc > 0.000001:
                proceeds = sell_btc * price
                fee = proceeds * fee_rate
                net_proceeds = proceeds - fee
                current_avg_cost = (weighted_cost_basis_usd / sdca_btc) if sdca_btc > 0 else price
                cost_of_sold_btc = sell_btc * current_avg_cost
                net_pnl_usd = net_proceeds - cost_of_sold_btc
                return_pct = (net_pnl_usd / cost_of_sold_btc) * 100.0 if cost_of_sold_btc > 0 else 0.0
                
                if net_pnl_usd >= 0:
                    wins += 1
                    gross_profit += net_pnl_usd
                else:
                    losses += 1
                    gross_loss += abs(net_pnl_usd)
                    
                sdca_btc -= sell_btc
                sdca_cash += net_proceeds
                weighted_cost_basis_usd = max(0.0, weighted_cost_basis_usd - cost_of_sold_btc)
                total_fees += fee
                
                trade_id += 1
                trade_log.append({
                    "id": trade_id,
                    "date": day.date,
                    "action": "SELL",
                    "amount_usd": round(net_proceeds, 2),
                    "btc_price": price,
                    "multiplier": multiplier,
                    "phase": signal["phase"],
                    "net_pnl_usd": round(net_pnl_usd, 2),
                    "profit_pct": round(return_pct, 2)
                })
                total_trades += 1
                
        # Simple DCA: fixed $100 every day regardless of signal
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
        dd = (peak_sdca - sdca_equity) / peak_sdca if peak_sdca > 0 else 0.0
        if dd > max_drawdown:
            max_drawdown = dd
            
        if buy_hold_equity > peak_market:
            peak_market = buy_hold_equity
        dd_m = (peak_market - buy_hold_equity) / peak_market if peak_market > 0 else 0.0
        if dd_m > max_drawdown_market:
            max_drawdown_market = dd_m
            
    # Final metrics
    n = len(data)
    years = n / 365.25
    final_sdca_equity = equity_curve[-1]["sdca"] if equity_curve else initial_cash
    final_market_equity = equity_curve[-1]["buyHold"] if equity_curve else initial_cash
    
    total_return = ((final_sdca_equity - initial_cash) / initial_cash) * 100.0 if initial_cash > 0 else 0.0
    total_return_market = ((final_market_equity - initial_cash) / initial_cash) * 100.0 if initial_cash > 0 else 0.0
    
    cagr = 0.0
    if years > 0 and final_sdca_equity > 0 and initial_cash > 0:
        cagr = ((final_sdca_equity / initial_cash) ** (1 / years) - 1) * 100.0
        
    annualized_return_market = 0.0
    if years > 0 and final_market_equity > 0 and initial_cash > 0:
        annualized_return_market = ((final_market_equity / initial_cash) ** (1 / years) - 1) * 100.0
        
    # Daily returns for volatility/sharpe
    daily_returns = []
    market_daily_returns = []
    for i in range(1, len(equity_curve)):
        prev = equity_curve[i-1]["sdca"]
        curr = equity_curve[i]["sdca"]
        if prev > 0:
            daily_returns.append((curr - prev) / prev)
            
        prev_m = equity_curve[i-1]["buyHold"]
        curr_m = equity_curve[i]["buyHold"]
        if prev_m > 0:
            market_daily_returns.append((curr_m - prev_m) / prev_m)
            
    mean_return = sum(daily_returns) / len(daily_returns) if daily_returns else 0.0
    variance = sum((r - mean_return) ** 2 for r in daily_returns) / len(daily_returns) if daily_returns else 0.0
    annualized_volatility = math.sqrt(variance) * math.sqrt(365) * 100.0
    annualized_return = mean_return * 365 * 100.0
    sharpe_ratio = annualized_return / annualized_volatility if annualized_volatility > 0 else 0.0
    
    mean_return_m = sum(market_daily_returns) / len(market_daily_returns) if market_daily_returns else 0.0
    var_m = sum((r - mean_return_m) ** 2 for r in market_daily_returns) / len(market_daily_returns) if market_daily_returns else 0.0
    annualized_volatility_market = math.sqrt(var_m) * math.sqrt(365) * 100.0
    sharpe_ratio_market = (mean_return_m * 365 * 100.0) / annualized_volatility_market if annualized_volatility_market > 0 else 0.0
    
    negative_returns = [r for r in daily_returns if r < 0]
    downside_variance = sum(r ** 2 for r in negative_returns) / len(daily_returns) if daily_returns else 0.0
    sortino_ratio = (mean_return * 365) / (math.sqrt(downside_variance) * math.sqrt(365)) if downside_variance > 0 else 0.0
    
    total_completed_trades = wins + losses
    profit_factor = (gross_profit / gross_loss) if gross_loss > 0 else (999.0 if gross_profit > 0 else 0.0)
    win_rate = (wins / total_completed_trades * 100.0) if total_completed_trades > 0 else ((wins / total_trades * 100.0) if total_trades > 0 else 0.0)
    avg_cost_basis = (weighted_cost_basis_usd / sdca_btc) if sdca_btc > 0 else 0.0
    
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
            "cagr": round(cagr, 2),
            "sharpeRatioMarket": round(sharpe_ratio_market, 2),
            "annualizedReturnMarket": round(annualized_return_market, 2),
            "annualizedVolatilityMarket": round(annualized_volatility_market, 2),
            "maxDrawdownMarket": round(max_drawdown_market * 100, 1),
            "avgCostBasis": round(avg_cost_basis, 2)
        },
        "equity_curve": equity_curve,
        "trade_log": trade_log,
        "signals": signals,
        "config": config,
        "thresholds": thresholds
    }
