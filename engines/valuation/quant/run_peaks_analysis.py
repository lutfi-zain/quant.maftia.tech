import os
import sys
import sqlite3
import pandas as pd
import numpy as np

sys.path.append("/home/ubuntu/projects/quant.maftia.tech/engines/valuation")
from quant.components.bitview_client import fetch_series

DB_PATH = 'engines/valuation/database/metrics.db'

def get_connection():
    return sqlite3.connect(DB_PATH)

def analyze_peaks():
    conn = get_connection()
    df_price = pd.read_sql('SELECT date, close FROM btc_ohlc ORDER BY date ASC', conn)
    df_price['date'] = pd.to_datetime(df_price['date'])
    df_price.set_index('date', inplace=True)

    # 1. Define cycle windows and find exact peak dates
    cycles = {
        '2013 Peak (Cycle 1)': ('2011-01-01', '2013-12-31'),
        '2017 Peak (Cycle 2)': ('2014-01-01', '2017-12-31'),
        '2021 Apr Peak (Cycle 3a)': ('2021-03-01', '2021-05-15'),
        '2021 Nov Peak (Cycle 3b)': ('2021-10-01', '2021-12-15'),
        '2024 Mar Peak (Cycle 4a)': ('2024-02-01', '2024-04-15'),
        '2025 Top Peak (Cycle 4b)': ('2025-09-01', '2025-12-31')
    }

    peak_dates = {}
    for name, (start, end) in cycles.items():
        sub = df_price.loc[start:end]
        if not sub.empty:
            peak_date = sub['close'].idxmax()
            peak_dates[name] = peak_date
            print(f"{name}: Date = {peak_date.strftime('%Y-%m-%d')}, Close = ${sub.loc[peak_date, 'close']:,.2f}")

    # 2. Fetch on-chain metrics from bitview API
    print("\nFetching on-chain series from bitview.space API...")
    lth_supply = fetch_series('lth_supply', start_date='2010-01-01')
    sth_supply = fetch_series('sth_supply', start_date='2010-01-01')
    total_supply = fetch_series('supply', start_date='2010-01-01')
    realized_cap = fetch_series('realized_cap', start_date='2010-01-01')
    coindays_destroyed_1m = fetch_series('coindays_destroyed_sum_1m', start_date='2010-01-01')

    # Process and align on-chain data
    dfs = []
    for name, df in [
        ('lth_supply', lth_supply),
        ('sth_supply', sth_supply),
        ('total_supply', total_supply),
        ('realized_cap', realized_cap),
        ('coindays_destroyed_1m', coindays_destroyed_1m)
    ]:
        df['date'] = pd.to_datetime(df['date'])
        df.set_index('date', inplace=True)
        dfs.append(df['value'].rename(name))

    onchain = pd.concat(dfs, axis=1)
    onchain['lth_ratio'] = onchain['lth_supply'] / onchain['total_supply']
    onchain['sth_ratio'] = onchain['sth_supply'] / onchain['total_supply']
    onchain['active_ratio'] = 1.0 - onchain['lth_ratio']
    onchain['illiquidity_factor'] = onchain['lth_ratio'] / onchain['active_ratio']

    # Cumulative average of Illiquidity Factor (expanding window)
    onchain['illiquidity_cum_mean'] = onchain['illiquidity_factor'].expanding(min_periods=365).mean()
    # Causal: shift by 1 day so today's multiplier uses the cumulative mean up to day t-1
    onchain['iip_multiplier'] = onchain['illiquidity_factor'] / onchain['illiquidity_cum_mean'].shift(1)
    onchain['iip_penalty'] = (onchain['iip_multiplier']**2 - 1.0).clip(lower=0.0)

    # Add spot price and realized price to onchain
    onchain = onchain.join(df_price['close'].rename('spot_price'), how='left')
    onchain['realized_price'] = onchain['realized_cap'] / onchain['total_supply']
    onchain['mvrv'] = onchain['spot_price'] / onchain['realized_price']

    # 3. Analyze each peak
    print("\n=== PEAK SUMMARY & COMPARISON ===")
    peak_summaries = []
    for label, p_date in peak_dates.items():
        # Get metrics from SQLite for this date
        p_date_str = p_date.strftime('%Y-%m-%d')
        df_metrics = pd.read_sql(f'''
            SELECT metric_name, normalized_value, raw_value
            FROM timeseries_metrics
            WHERE date LIKE '{p_date_str}%'
        ''', conn)

        # Get onchain parameters for this date
        onchain_vals = {}
        if p_date in onchain.index:
            onchain_row = onchain.loc[p_date]
            onchain_vals = {
                'spot_price': onchain_row['spot_price'],
                'realized_cap_b': onchain_row['realized_cap'] / 1e9,
                'realized_price': onchain_row['realized_price'],
                'mvrv': onchain_row['mvrv'],
                'lth_ratio': onchain_row['lth_ratio'],
                'active_ratio': onchain_row['active_ratio'],
                'illiquidity_factor': onchain_row['illiquidity_factor'],
                'iip_penalty': onchain_row['iip_penalty'],
                'coindays_destroyed_1m_m': onchain_row['coindays_destroyed_1m'] / 1e6
            }

        # Count extreme indicators
        total_indicators = len(df_metrics)
        extreme_m2 = sum(df_metrics['normalized_value'] <= -1.8) if total_indicators > 0 else 0
        extreme_m1_5 = sum(df_metrics['normalized_value'] <= -1.5) if total_indicators > 0 else 0
        mean_normalized = df_metrics['normalized_value'].mean() if total_indicators > 0 else np.nan

        summary = {
            'label': label,
            'date': p_date_str,
            'total_indicators': total_indicators,
            'extreme_m2': extreme_m2,
            'extreme_m1_5': extreme_m1_5,
            'mean_normalized': mean_normalized,
            **onchain_vals
        }
        peak_summaries.append(summary)

        print(f"\nPeak: {label} ({p_date_str})")
        print(f"  Spot Price: ${summary.get('spot_price', 0.0):,.2f}")
        print(f"  Realized Price: ${summary.get('realized_price', 0.0):,.2f} | MVRV: {summary.get('mvrv', 0.0):.2f}")
        print(f"  LTH Supply Ratio: {summary.get('lth_ratio', 0.0):.2%} | Active Supply Ratio: {summary.get('active_ratio', 0.0):.2%}")
        print(f"  Illiquidity Factor: {summary.get('illiquidity_factor', 0.0):.2f} | IIP Penalty: {summary.get('iip_penalty', 0.0):.2f}")
        print(f"  Coindays Destroyed (1M): {summary.get('coindays_destroyed_1m_m', 0.0):,.2f} million")
        print(f"  Mean Indicator Score: {mean_normalized:.3f}")
        print(f"  Indicators reaching extreme top (<= -1.8): {extreme_m2} / {total_indicators}")
        print(f"  Indicators reaching near top (<= -1.5): {extreme_m1_5} / {total_indicators}")

    df_peaks = pd.DataFrame(peak_summaries)

    # Save the data to a csv for notebook access
    onchain.reset_index().to_csv('engines/valuation/quant/onchain_cycle_data.csv', index=False)
    df_peaks.to_csv('engines/valuation/quant/peak_comparison.csv', index=False)
    print("\nSaved on-chain dataset and peak comparison to CSV files.")

    conn.close()

if __name__ == '__main__':
    analyze_peaks()
