import numpy as np
import pandas as pd
from typing import Dict, Any, List


def run_backtest(df: pd.DataFrame, transaction_cost: float = 0.001) -> pd.DataFrame:
    """
    Computes vectorized equity curves and trades based on 'Pos' column.
    
    Position executes on the next day's open-to-close return to eliminate execution look-ahead bias.
    """
    if 'Pos' not in df.columns:
        raise ValueError("Pos column not found. Run generate_signals first.")
        
    df = df.copy()
    
    # Position acts on the *next* day's return (signal at close -> return next close)
    df['Active_Pos'] = df['Pos'].shift(1).fillna(0)
    
    prev_close = df['Close'].shift(1)
    df['Market_Ret'] = np.where(prev_close > 0, (df['Close'] - prev_close) / prev_close, 0.0)
    df['Strat_Raw_Ret'] = df['Active_Pos'] * df['Market_Ret']
    
    # Calculate transaction costs when position changes
    df['TC'] = df['Active_Pos'].diff().abs().fillna(0) * transaction_cost
    df['Strat_Net_Ret'] = df['Strat_Raw_Ret'] - df['TC']
    
    # Cumulative curves
    df['Cum_Market'] = (1 + df['Market_Ret'].fillna(0)).cumprod() - 1
    df['Cum_Strat'] = (1 + df['Strat_Net_Ret'].fillna(0)).cumprod() - 1
    
    return df


def calculate_metrics(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Calculates key quantitative metrics from a backtest dataframe.
    """
    if 'Strat_Net_Ret' not in df.columns or len(df) == 0:
        return {}
        
    ann_factor = 365.25
    ann_market = df['Market_Ret'].mean() * ann_factor
    ann_strat = df['Strat_Net_Ret'].mean() * ann_factor
    
    vol_market = df['Market_Ret'].std() * np.sqrt(ann_factor)
    vol_strat = df['Strat_Net_Ret'].std() * np.sqrt(ann_factor)
    
    sharpe_strat = ann_strat / vol_strat if vol_strat > 0 else 0.0
    sharpe_market = ann_market / vol_market if vol_market > 0 else 0.0
    
    equity = df['Cum_Strat'] + 1
    mdd_strat = ((equity.cummax() - equity) / equity.cummax()).max()
    
    market_eq = df['Cum_Market'] + 1
    mdd_market = ((market_eq.cummax() - market_eq) / market_eq.cummax()).max()
    
    # Identify contiguous active trades to calculate Win Rate and Profit Factor
    df_temp = df.copy()
    is_active = (df_temp['Active_Pos'] > 0).astype(int)
    trade_start = (is_active == 1) & (is_active.shift(1, fill_value=0) == 0)
    df_temp['trade_id'] = trade_start.cumsum()
    in_trade = df_temp[df_temp['Active_Pos'] > 0]
    
    win_rate = 0.0
    profit_factor = 1.0
    trades = 0
    
    if len(in_trade) > 0:
        trade_returns = []
        for _, group in in_trade.groupby('trade_id'):
            trade_ret = (1.0 + group['Strat_Net_Ret']).prod() - 1.0
            trade_returns.append(trade_ret)
        
        trade_returns = np.array(trade_returns)
        trades = len(trade_returns)
        
        wins = trade_returns[trade_returns > 0]
        losses = trade_returns[trade_returns <= 0]
        
        if trades > 0:
            win_rate = len(wins) / trades * 100
        if len(losses) > 0 and abs(losses.sum()) > 0:
            profit_factor = wins.sum() / abs(losses.sum())
        else:
            profit_factor = wins.sum() if len(wins) > 0 else 1.0
    else:
        trades = 0
        
    return {
        'Total Return (%)': df['Cum_Strat'].iloc[-1] * 100,
        'Ann. Return (%)': ann_strat * 100,
        'Ann. Volatility (%)': vol_strat * 100,
        'Max Drawdown (%)': mdd_strat * 100,
        'Sharpe Ratio': sharpe_strat,
        'Number of Trades': trades,
        'Win Rate (%)': win_rate,
        'Profit Factor': profit_factor,
        'Market Total Return (%)': df['Cum_Market'].iloc[-1] * 100,
        'Market Max Drawdown (%)': mdd_market * 100,
        'Market Sharpe Ratio': sharpe_market
    }


def print_benchmark_comparison_table(metrics_base: Dict[str, Any], metrics_7b: Dict[str, Any], title: str = "BENCHMARK PERFORMANCE COMPARISON"):
    """
    Prints a formatted side-by-side benchmark comparison matrix.
    """
    print("\n" + "=" * 80)
    print(f"      {title}")
    print("=" * 80)
    print(f"{'Metric':<25} | {'Grid Baseline':<15} | {'7-Book v4.0':<15} | {'Delta / Improvement':<20}")
    print("-" * 80)
    
    display_keys = [
        ('Sharpe Ratio', False),
        ('Total Return (%)', True),
        ('Ann. Return (%)', True),
        ('Ann. Volatility (%)', True),
        ('Max Drawdown (%)', True),
        ('Profit Factor', False),
        ('Win Rate (%)', True),
        ('Number of Trades', False),
    ]
    
    for key, is_pct in display_keys:
        v_base = metrics_base.get(key, 0.0)
        v_7b = metrics_7b.get(key, 0.0)
        diff = v_7b - v_base
        
        if key == 'Number of Trades':
            print(f"{key:<25} | {int(v_base):>14} | {int(v_7b):>14} | {int(diff):>+19}")
        elif is_pct:
            print(f"{key:<25} | {v_base:>13.2f}% | {v_7b:>13.2f}% | {diff:>+18.2f}%")
        else:
            print(f"{key:<25} | {v_base:>14.2f} | {v_7b:>14.2f} | {diff:>+19.2f}")
            
    print("=" * 80 + "\n")


def run_walk_forward_validation(df_data: pd.DataFrame,
                                n_folds: int = 5,
                                train_ratio: float = 0.6,
                                embargo_days: int = 5) -> pd.DataFrame:
    """
    Executes 5-fold rolling walk-forward validation with embargo gap
    per lz-quant-researcher production pattern.
    """
    from src.ichimoku_quant.features import generate_ichimoku_features
    from src.ichimoku_quant.strategy import generate_signals

    total_days = len(df_data)
    fold_size = total_days // n_folds
    results = []

    for fold in range(n_folds):
        fold_start = fold * fold_size
        fold_end = min((fold + 1) * fold_size, total_days)

        train_end_idx = fold_start + int((fold_end - fold_start) * train_ratio)
        test_start_idx = train_end_idx + embargo_days

        if test_start_idx >= fold_end:
            continue

        train_data = df_data.iloc[fold_start:train_end_idx]
        test_data = df_data.iloc[test_start_idx:fold_end]

        train_feat = generate_ichimoku_features(train_data)
        train_sig = generate_signals(train_feat)
        train_bt = run_backtest(train_sig, transaction_cost=0.001)

        test_full_data = df_data.iloc[:fold_end]
        test_full_feat = generate_ichimoku_features(test_full_data)
        test_full_sig = generate_signals(test_full_feat)
        test_full_bt = run_backtest(test_full_sig, transaction_cost=0.001)

        test_eval_bt = test_full_bt.iloc[test_start_idx:fold_end].copy()
        test_eval_bt['Cum_Strat'] = (1 + test_eval_bt['Strat_Net_Ret'].fillna(0)).cumprod() - 1
        test_eval_bt['Cum_Market'] = (1 + test_eval_bt['Market_Ret'].fillna(0)).cumprod() - 1

        m_train = calculate_metrics(train_bt)
        m_test = calculate_metrics(test_eval_bt)

        is_sharpe = m_train.get('Sharpe Ratio', 0.0)
        oos_sharpe = m_test.get('Sharpe Ratio', 0.0)
        decay = (1 - oos_sharpe / is_sharpe) if is_sharpe > 0 else 0.0

        results.append({
            'Fold': fold + 1,
            'Train Period': f"{train_data.index[0].strftime('%Y-%m-%d')} -> {train_data.index[-1].strftime('%Y-%m-%d')}",
            'Test Period': f"{test_data.index[0].strftime('%Y-%m-%d')} -> {test_data.index[-1].strftime('%Y-%m-%d')}",
            'IS Sharpe': is_sharpe,
            'OOS Sharpe': oos_sharpe,
            'Sharpe Decay': f"{decay * 100:.1f}%",
            'OOS Strat Ret': f"{m_test.get('Total Return (%)', 0.0):+,.2f}%",
            'OOS Mkt Ret': f"{m_test.get('Market Total Return (%)', 0.0):+,.2f}%",
            'OOS Max DD': f"{m_test.get('Max Drawdown (%)', 0.0):.2f}%",
            'OOS Mkt Max DD': f"{m_test.get('Market Max Drawdown (%)', 0.0):.2f}%",
            'OOS PF': f"{m_test.get('Profit Factor', 0.0):.2f}",
            'OOS Trades': m_test.get('Number of Trades', 0)
        })

    return pd.DataFrame(results)
