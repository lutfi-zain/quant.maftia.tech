#!/usr/bin/env python3
"""
SDCA Strategy Grid Search Audit
================================
Audits the SDCA strategy by grid searching over buy (DCA In) and sell (DCA Out) conditions.

Grid Parameters:
- Buy Threshold: composite crossover level to trigger DCA IN
- Sell Threshold: composite crossover level to trigger DCA OUT
- Price Percentile Buy: price percentile threshold for buy entries
- Price Percentile Sell: price percentile threshold for sell exits

Metrics Computed:
- Sharpe Ratio, Sortino Ratio, Max Drawdown, CAGR
- Total Return, Win Rate, Profit Factor
- Walk-Forward Out-of-Sample Sharpe
"""

import sqlite3
import numpy as np
import pandas as pd
from itertools import product
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

# ─── Database Path ──────────────────────────────────────────────────────────
DB_PATH = "/home/ubuntu/projects/quant.maftia.tech/data/maftia_quant.db"

def load_data():
    """Load daily data from unified_daily_analytics + master_ohlcv."""
    conn = sqlite3.connect(DB_PATH)
    sql = """
        SELECT
            u.date,
            COALESCE(m.close, u.btc_price) as close,
            u.valuation_composite
        FROM unified_daily_analytics u
        LEFT JOIN master_ohlcv m ON u.date = m.date
        WHERE COALESCE(m.close, u.btc_price) IS NOT NULL
          AND u.valuation_composite IS NOT NULL
        ORDER BY u.date ASC
    """
    df = pd.read_sql(sql, conn)
    conn.close()
    df['close'] = df['close'].astype(float)
    df['valuation_composite'] = df['valuation_composite'].astype(float)
    return df


def price_percentile(prices, current_idx, window=365):
    """Calculate price percentile within rolling window (causal)."""
    start = max(0, current_idx - window)
    window_prices = prices[start:current_idx]
    if len(window_prices) == 0:
        return 50.0
    return (np.sum(window_prices < prices[current_idx]) / len(window_prices)) * 100


def composite_trend(composites, current_idx):
    """Calculate composite trend: True if 7d avg > 30d avg."""
    valid = composites[:current_idx]
    if len(valid) < 30:
        return True
    avg7 = np.mean(valid[-7:])
    avg30 = np.mean(valid[-30:])
    return avg7 > avg30


def sdca_backtest(df, buy_threshold, sell_threshold, 
                  price_pct_buy=25, price_pct_sell=80,
                  base_dca=100, fee_bps=10, initial_cash=10000):
    """
    Run SDCA backtest with custom buy/sell thresholds.
    
    Args:
        buy_threshold: composite level to trigger DCA IN (positive = undervalued)
        sell_threshold: composite level to trigger DCA OUT (negative = overvalued)
        price_pct_buy: price percentile below which to buy
        price_pct_sell: price percentile above which to sell
        base_dca: base DCA amount in USD
        fee_bps: transaction fee in basis points
        initial_cash: starting cash amount
    
    Returns:
        dict with metrics and equity curve
    """
    closes = df['close'].values
    composites = df['valuation_composite'].values
    dates = df['date'].values
    n = len(df)
    
    fee_rate = fee_bps / 10000
    
    # State tracking
    cash = initial_cash
    btc = 0.0
    total_invested = 0
    peak_equity = initial_cash
    max_dd = 0
    wins = 0
    total_trades = 0
    gross_profit = 0
    gross_loss = 0
    
    # Simple DCA baseline
    simple_cash = initial_cash
    simple_btc = 0.0
    
    equity_curve = []
    trade_log = []
    
    for i in range(n):
        price = closes[i]
        if price <= 0:
            continue
        
        # t-1 causal enforcement
        composite_t1 = composites[i-1] if i > 0 else 0
        composite_t2 = composites[i-2] if i > 1 else composite_t1
        
        # Price percentile (causal)
        pct = price_percentile(closes, i)
        
        # Trend
        trend = composite_trend(composites, i)
        
        # Determine multiplier based on thresholds
        multiplier = 1.0  # Default: normal DCA
        
        # Buy condition: composite crosses above buy_threshold
        if composite_t1 >= buy_threshold:
            multiplier = 2.0  # Aggressive buy
        elif composite_t1 >= buy_threshold * 0.5:
            multiplier = 1.5  # Moderate buy
        elif composite_t1 <= -abs(buy_threshold) * 0.5:
            multiplier = 0.5  # Reduce
        elif composite_t1 <= -abs(buy_threshold):
            multiplier = 0.0  # Pause
        elif composite_t1 <= sell_threshold:
            multiplier = -0.5  # Sell
        
        # Execute SDCA trade
        sdca_amount = base_dca * multiplier
        
        if sdca_amount > 0:
            # Buy
            fee = sdca_amount * fee_rate
            net = sdca_amount - fee
            btc_bought = net / price
            btc += btc_bought
            cash -= sdca_amount
            total_invested += sdca_amount
            total_trades += 1
            
            trade_log.append({
                'date': dates[i],
                'action': 'BUY',
                'amount': sdca_amount,
                'price': price,
                'multiplier': multiplier
            })
        
        elif sdca_amount < 0:
            # Sell
            sell_amount = abs(sdca_amount)
            btc_to_sell = min(sell_amount / price, btc)
            if btc_to_sell > 0:
                proceeds = btc_to_sell * price
                fee = proceeds * fee_rate
                btc -= btc_to_sell
                cash += proceeds - fee
                total_trades += 1
                
                ret_pct = ((proceeds - fee) / sell_amount - 1) * 100 if sell_amount > 0 else 0
                if ret_pct > 0:
                    wins += 1
                    gross_profit += ret_pct
                else:
                    gross_loss += abs(ret_pct)
                
                trade_log.append({
                    'date': dates[i],
                    'action': 'SELL',
                    'amount': proceeds,
                    'price': price,
                    'multiplier': multiplier
                })
        
        # Simple DCA baseline
        simple_fee = base_dca * fee_rate
        simple_net = base_dca - simple_fee
        simple_btc += simple_net / price
        simple_cash -= base_dca
        
        # Compute equity
        equity = cash + btc * price
        simple_equity = simple_cash + simple_btc * price
        
        equity_curve.append({
            'date': dates[i],
            'sdca': equity,
            'simple_dca': simple_equity
        })
        
        # Max drawdown
        if equity > peak_equity:
            peak_equity = equity
        dd = (peak_equity - equity) / peak_equity
        if dd > max_dd:
            max_dd = dd
    
    # Compute metrics
    equity_arr = np.array([e['sdca'] for e in equity_curve])
    simple_arr = np.array([e['simple_dca'] for e in equity_curve])
    
    # Daily returns
    daily_returns = np.diff(equity_arr) / equity_arr[:-1]
    
    # Metrics
    total_return = ((equity_arr[-1] / initial_cash) - 1) * 100 if len(equity_arr) > 0 else 0
    years = n / 365.25
    cagr = ((equity_arr[-1] / initial_cash) ** (1/years) - 1) * 100 if years > 0 and equity_arr[-1] > 0 else 0
    
    mean_ret = np.mean(daily_returns) if len(daily_returns) > 0 else 0
    vol = np.std(daily_returns) * np.sqrt(365) if len(daily_returns) > 0 else 1
    sharpe = (mean_ret * 365) / vol if vol > 0 else 0
    
    # Sortino
    neg_returns = daily_returns[daily_returns < 0]
    downside_vol = np.std(neg_returns) * np.sqrt(365) if len(neg_returns) > 0 else 1
    sortino = (mean_ret * 365) / downside_vol if downside_vol > 0 else 0
    
    win_rate = (wins / total_trades * 100) if total_trades > 0 else 0
    profit_factor = gross_profit / gross_loss if gross_loss > 0 else (999 if gross_profit > 0 else 0)
    
    # Simple DCA comparison
    simple_total_return = ((simple_arr[-1] / initial_cash) - 1) * 100 if len(simple_arr) > 0 else 0
    
    return {
        'sharpe': round(sharpe, 2),
        'sortino': round(sortino, 2),
        'max_dd': round(max_dd * 100, 1),
        'cagr': round(cagr, 1),
        'total_return': round(total_return, 1),
        'win_rate': round(win_rate, 1),
        'profit_factor': round(profit_factor, 2),
        'total_trades': total_trades,
        'simple_dca_return': round(simple_total_return, 1),
        'final_equity': round(equity_arr[-1], 2) if len(equity_arr) > 0 else initial_cash,
        'dates': dates,
        'equity_curve': equity_curve
    }


def walk_forward_validation(df, buy_threshold, sell_threshold, 
                            train_years=3, test_months=6, n_folds=4):
    """Walk-forward out-of-sample validation."""
    dates = pd.to_datetime(df['date'])
    start_date = dates.min()
    end_date = dates.max()
    
    fold_results = []
    train_days = train_years * 365
    test_days = test_months * 30
    
    for fold in range(n_folds):
        fold_start = start_date + pd.Timedelta(days=fold * test_days)
        train_end = fold_start + pd.Timedelta(days=train_days)
        test_end = train_end + pd.Timedelta(days=test_days)
        
        if test_end > end_date:
            break
        
        # Split data
        train_mask = (dates >= fold_start) & (dates < train_end)
        test_mask = (dates >= train_end) & (dates < test_end)
        
        train_df = df[train_mask].reset_index(drop=True)
        test_df = df[test_mask].reset_index(drop=True)
        
        if len(train_df) < 100 or len(test_df) < 30:
            continue
        
        # Run backtest on test set
        result = sdca_backtest(
            test_df, buy_threshold, sell_threshold,
            base_dca=100, fee_bps=10, initial_cash=10000
        )
        
        fold_results.append({
            'fold': fold + 1,
            'train_period': f"{fold_start.date()} to {train_end.date()}",
            'test_period': f"{train_end.date()} to {test_end.date()}",
            'test_days': len(test_df),
            'sharpe': result['sharpe'],
            'total_return': result['total_return'],
            'max_dd': result['max_dd'],
            'trades': result['total_trades']
        })
    
    if not fold_results:
        return None
    
    avg_sharpe = np.mean([f['sharpe'] for f in fold_results])
    avg_return = np.mean([f['total_return'] for f in fold_results])
    avg_dd = np.mean([f['max_dd'] for f in fold_results])
    
    return {
        'n_folds': len(fold_results),
        'avg_oos_sharpe': round(avg_sharpe, 2),
        'avg_oos_return': round(avg_return, 1),
        'avg_oos_max_dd': round(avg_dd, 1),
        'folds': fold_results
    }


def grid_search(df):
    """Grid search over buy and sell conditions."""
    print("\n" + "="*80)
    print(" SDCA STRATEGY GRID SEARCH AUDIT")
    print("="*80)
    
    # Grid parameters
    buy_thresholds = [0.5, 0.8, 1.0, 1.2, 1.5]  # Buy composite threshold
    sell_thresholds = [-0.5, -0.8, -1.0, -1.2, -1.5]  # Sell composite threshold
    
    print("\nGrid Parameters:")
    print(f"  Buy Thresholds (DCA In):  {buy_thresholds}")
    print(f"  Sell Thresholds (DCA Out): {sell_thresholds}")
    print(f"  Total Combinations: {len(buy_thresholds) * len(sell_thresholds)}")
    
    # Run grid search
    results = []
    
    for buy_t, sell_t in product(buy_thresholds, sell_thresholds):
        if buy_t <= abs(sell_t):
            continue  # Skip invalid combinations
        
        result = sdca_backtest(df, buy_t, sell_t)
        result['buy_threshold'] = buy_t
        result['sell_threshold'] = sell_t
        results.append(result)
    
    # Sort by Sharpe ratio
    results.sort(key=lambda x: x['sharpe'], reverse=True)
    
    print("\n" + "-"*80)
    print(" TOP 10 PARAMETER COMBINATIONS (by Sharpe Ratio)")
    print("-"*80)
    print(f"{'Buy':>6} {'Sell':>6} {'Sharpe':>8} {'Sortino':>8} {'CAGR':>8} {'MaxDD':>8} {'Return':>10} {'WinRate':>8} {'PF':>6}")
    print("-"*80)
    
    for i, r in enumerate(results[:10]):
        print(f"{r['buy_threshold']:>6.1f} {r['sell_threshold']:>6.1f} {r['sharpe']:>8.2f} {r['sortino']:>8.2f} "
              f"{r['cagr']:>7.1f}% {r['max_dd']:>7.1f}% {r['total_return']:>9.1f}% {r['win_rate']:>7.1f}% {r['profit_factor']:>6.2f}")
    
    print("\n" + "-"*80)
    print(" BOTTOM 5 PARAMETER COMBINATIONS (by Sharpe Ratio)")
    print("-"*80)
    for i, r in enumerate(results[-5:]):
        print(f"{r['buy_threshold']:>6.1f} {r['sell_threshold']:>6.1f} {r['sharpe']:>8.2f} {r['sortino']:>8.2f} "
              f"{r['cagr']:>7.1f}% {r['max_dd']:>7.1f}% {r['total_return']:>9.1f}% {r['win_rate']:>7.1f}% {r['profit_factor']:>6.2f}")
    
    return results


def analyze_current_strategy(df):
    """Analyze the current SDCA strategy (buy_threshold=1.0, sell_threshold=-1.0)."""
    print("\n" + "="*80)
    print(" CURRENT SDCA STRATEGY ANALYSIS")
    print("="*80)
    
    result = sdca_backtest(df, buy_threshold=1.0, sell_threshold=-1.0)
    
    print(f"\nConfiguration:")
    print(f"  Buy Threshold:  +1.0 (composite crosses above → DCA IN)")
    print(f"  Sell Threshold: -1.0 (composite crosses below → DCA OUT)")
    
    print(f"\nPerformance Metrics:")
    print(f"  Sharpe Ratio:      {result['sharpe']:>8.2f}")
    print(f"  Sortino Ratio:     {result['sortino']:>8.2f}")
    print(f"  CAGR:              {result['cagr']:>7.1f}%")
    print(f"  Total Return:      {result['total_return']:>9.1f}%")
    print(f"  Max Drawdown:      {result['max_dd']:>7.1f}%")
    print(f"  Win Rate:          {result['win_rate']:>7.1f}%")
    print(f"  Profit Factor:     {result['profit_factor']:>6.2f}")
    print(f"  Total Trades:      {result['total_trades']:>6d}")
    print(f"  Final Equity:      ${result['final_equity']:>12,.2f}")
    
    print(f"\nComparison to Simple DCA:")
    print(f"  Simple DCA Return: {result['simple_dca_return']:>9.1f}%")
    print(f"  SDCA Alpha:        {result['total_return'] - result['simple_dca_return']:>+9.1f}%")
    
    return result


def walk_forward_analysis(df):
    """Run walk-forward validation on current strategy."""
    print("\n" + "="*80)
    print(" WALK-FORWARD OUT-OF-SAMPLE VALIDATION")
    print("="*80)
    
    wf = walk_forward_validation(df, buy_threshold=1.0, sell_threshold=-1.0)
    
    if wf:
        print(f"\nConfiguration:")
        print(f"  Train Window: 3 years")
        print(f"  Test Period: 6 months")
        print(f"  Folds: {wf['n_folds']}")
        
        print(f"\nOut-of-Sample Results:")
        print(f"  Average OOS Sharpe:   {wf['avg_oos_sharpe']:>8.2f}")
        print(f"  Average OOS Return:   {wf['avg_oos_return']:>7.1f}%")
        print(f"  Average OOS Max DD:   {wf['avg_oos_max_dd']:>7.1f}%")
        
        print(f"\nPer-Fold Breakdown:")
        print(f"  {'Fold':>4} {'Test Period':>25} {'Days':>5} {'Sharpe':>8} {'Return':>10} {'MaxDD':>8} {'Trades':>7}")
        print("  " + "-"*70)
        for fold in wf['folds']:
            print(f"  {fold['fold']:>4} {fold['test_period']:>25} {fold['test_days']:>5} "
                  f"{fold['sharpe']:>8.2f} {fold['total_return']:>9.1f}% {fold['max_dd']:>7.1f}% {fold['trades']:>7}")
    else:
        print("\n  WARNING: Insufficient data for walk-forward validation")
    
    return wf


def sensitivity_analysis(df):
    """Analyze sensitivity to key parameters."""
    print("\n" + "="*80)
    print(" SENSITIVITY ANALYSIS")
    print("="*80)
    
    # Test different fee levels
    print("\n1. Fee Sensitivity (at buy=1.0, sell=-1.0):")
    fees = [0, 5, 10, 25, 50]
    print(f"  {'Fee (bps)':>10} {'Sharpe':>8} {'Return':>10} {'MaxDD':>8}")
    print("  " + "-"*40)
    for fee in fees:
        r = sdca_backtest(df, 1.0, -1.0, fee_bps=fee)
        print(f"  {fee:>10d} {r['sharpe']:>8.2f} {r['total_return']:>9.1f}% {r['max_dd']:>7.1f}%")
    
    # Test different initial cash levels
    print("\n2. Capital Sensitivity (at buy=1.0, sell=-1.0, fee=10bps):")
    capitals = [1000, 5000, 10000, 50000, 100000]
    print(f"  {'Initial Cash':>12} {'Sharpe':>8} {'Return':>10} {'Final':>12}")
    print("  " + "-"*48)
    for cap in capitals:
        r = sdca_backtest(df, 1.0, -1.0, initial_cash=cap)
        print(f"  ${cap:>11,} {r['sharpe']:>8.2f} {r['total_return']:>9.1f}% ${r['final_equity']:>11,.2f}")
    
    # Test different DCA amounts
    print("\n3. DCA Amount Sensitivity (at buy=1.0, sell=-1.0):")
    amounts = [50, 100, 200, 500]
    print(f"  {'DCA Amount':>10} {'Sharpe':>8} {'Trades':>7} {'Final':>12}")
    print("  " + "-"*42)
    for amt in amounts:
        r = sdca_backtest(df, 1.0, -1.0, base_dca=amt)
        print(f"  ${amt:>9,} {r['sharpe']:>8.2f} {r['total_trades']:>7} ${r['final_equity']:>11,.2f}")


def statistical_tests(df):
    """Perform statistical tests on strategy returns."""
    print("\n" + "="*80)
    print(" STATISTICAL TESTS")
    print("="*80)
    
    result = sdca_backtest(df, 1.0, -1.0)
    
    equity = np.array([e['sdca'] for e in result['equity_curve']])
    daily_returns = np.diff(equity) / equity[:-1]
    
    # Test for normality (Jarque-Bera)
    from scipy import stats
    jb_stat, jb_pval = stats.jarque_bera(daily_returns)
    print(f"\n1. Jarque-Bera Normality Test:")
    print(f"  Statistic: {jb_stat:.2f}")
    print(f"  p-value:   {jb_pval:.6f}")
    normality = 'Non-normal' if jb_pval < 0.05 else 'Normal'
    print(f"  Result:    {normality} distribution")
    
    # Manual autocorrelation test (lag-1 correlation)
    print(f"\n2. Autocorrelation Analysis:")
    for lag in [1, 5, 10, 20]:
        if lag < len(daily_returns):
            autocorr = np.corrcoef(daily_returns[:-lag], daily_returns[lag:])[0, 1]
            significant = abs(autocorr) > 2 / np.sqrt(len(daily_returns))
            sig_text = 'Significant' if significant else 'No autocorrelation'
            print(f"  Lag {lag:>2}: ρ = {autocorr:.4f} ({sig_text})")
    
    # T-test against zero
    t_stat, t_pval = stats.ttest_1samp(daily_returns, 0)
    print(f"\n3. One-Sample T-Test (H0: mean return = 0):")
    print(f"  t-statistic: {t_stat:.4f}")
    print(f"  p-value:     {t_pval:.6f}")
    ttest_result = 'Reject H0 (alpha exists)' if t_pval < 0.05 else 'Fail to reject H0'
    print(f"  Result:      {ttest_result}")
    
    # Bootstrap confidence interval
    try:
        n_bootstrap = 10000
        bootstrap_returns = np.random.choice(daily_returns, size=(n_bootstrap, len(daily_returns)), replace=True)
        bootstrap_sharpes = np.mean(bootstrap_returns, axis=1) / np.std(bootstrap_returns, axis=1) * np.sqrt(365)
        ci_lower = float(np.percentile(bootstrap_sharpes, 2.5))
        ci_upper = float(np.percentile(bootstrap_sharpes, 97.5))
        print(f"\n4. Bootstrap 95% CI for Sharpe Ratio:")
        print(f"  Mean Sharpe: {np.mean(bootstrap_sharpes):.2f}")
        print(f"  95% CI:      [{ci_lower:.2f}, {ci_upper:.2f}]")
    except Exception as e:
        print(f"\n4. Bootstrap 95% CI: Error computing bootstrap CI: {e}")


def main():
    """Main audit function."""
    print("\n" + "="*80)
    print(" SDCA STRATEGY COMPREHENSIVE AUDIT")
    print(" Grid Search | Walk-Forward | Statistical Analysis")
    print("="*80)
    
    # Load data
    df = load_data()
    print(f"\nData Loaded:")
    print(f"  Total Days:   {len(df):,}")
    print(f"  Date Range:   {df['date'].min()} to {df['date'].max()}")
    print(f"  Price Range:  ${df['close'].min():,.0f} to ${df['close'].max():,.0f}")
    print(f"  Composite Range: {df['valuation_composite'].min():.3f} to {df['valuation_composite'].max():.3f}")
    
    # 1. Current strategy analysis
    current = analyze_current_strategy(df)
    
    # 2. Grid search
    grid_results = grid_search(df)
    
    # 3. Walk-forward validation
    wf = walk_forward_analysis(df)
    
    # 4. Sensitivity analysis
    sensitivity_analysis(df)
    
    # 5. Statistical tests
    statistical_tests(df)
    
    # Final summary
    best = grid_results[0]
    print("\n" + "="*80)
    print(" AUDIT SUMMARY & RECOMMENDATIONS")
    print("="*80)
    
    print("\n1. CURRENT STRATEGY PERFORMANCE:")
    print(f"   Sharpe: {current['sharpe']:.2f} | CAGR: {current['cagr']:.1f}% | MaxDD: {current['max_dd']:.1f}%")
    
    print("\n2. OPTIMAL PARAMETERS (from grid search):")
    print(f"   Best Buy Threshold:  +{best['buy_threshold']:.1f}")
    print(f"   Best Sell Threshold: {best['sell_threshold']:.1f}")
    print(f"   Best Sharpe: {best['sharpe']:.2f}")
    
    print("\n3. WALK-FORWARD VALIDATION:")
    if wf:
        print(f"   OOS Sharpe: {wf['avg_oos_sharpe']:.2f} (vs IS Sharpe: {current['sharpe']:.2f})")
        degradation = ((current['sharpe'] - wf['avg_oos_sharpe']) / current['sharpe'] * 100) if current['sharpe'] > 0 else 0
        print(f"   IS→OOS Degradation: {degradation:.1f}%")
        if degradation > 50:
            print("   ⚠️  WARNING: High overfitting risk (>50% degradation)")
        elif degradation > 30:
            print("   ⚠️  CAUTION: Moderate overfitting risk (30-50% degradation)")
        else:
            print("   ✓ Acceptable robustness (<30% degradation)")
    
    print("\n4. KEY FINDINGS:")
    if current['sharpe'] > 0:
        print(f"   ✓ Strategy has positive risk-adjusted returns")
    else:
        print(f"   ✗ Strategy has negative risk-adjusted returns")
    
    if current['total_return'] > current['simple_dca_return']:
        print(f"   ✓ SDCA outperforms simple DCA by {current['total_return'] - current['simple_dca_return']:.1f}%")
    else:
        print(f"   ✗ SDCA underperforms simple DCA")
    
    if current['max_dd'] < 50:
        print(f"   ✓ Max drawdown is manageable ({current['max_dd']:.1f}%)")
    else:
        print(f"   ⚠️  Max drawdown is severe ({current['max_dd']:.1f}%)")
    
    print("\n" + "="*80)


if __name__ == "__main__":
    main()
