import os
import sys
import sqlite3
import pandas as pd
import numpy as np

sys.path.append("/home/ubuntu/projects/quant.maftia.tech/engines/valuation")
DB_PATH = 'engines/valuation/database/metrics.db'

def analyze_indicators():
    conn = sqlite3.connect(DB_PATH)

    # 1. Load timeseries_metrics
    df = pd.read_sql('SELECT date, metric_name, raw_value, normalized_value FROM timeseries_metrics', conn)
    df['date'] = pd.to_datetime(df['date'], format='mixed', utc=True)

    # Pivot metrics to have one column per metric
    df_normalized = df.pivot_table(index='date', columns='metric_name', values='normalized_value', aggfunc='mean')
    df_raw = df.pivot_table(index='date', columns='metric_name', values='raw_value', aggfunc='mean')

    print(f"Loaded {df_normalized.shape[0]} rows and {df_normalized.shape[1]} metrics.")

    # Peak dates
    peaks = {
        '2013-12-04': '2013 Peak',
        '2017-12-16': '2017 Peak',
        '2021-04-15': '2021 Apr Peak',
        '2021-11-09': '2021 Nov Peak',
        '2024-03-13': '2024 Mar Peak',
        '2025-10-06': '2025 Top Peak'
    }

    # Extract indicators at peaks
    peak_normalized = {}
    for date_str, label in peaks.items():
        dt = pd.to_datetime(date_str, utc=True)
        # find closest date if exact date doesn't exist
        closest_dt = df_normalized.index[np.argmin(np.abs(df_normalized.index - dt))]
        peak_normalized[label] = df_normalized.loc[closest_dt]

    df_peak_metrics = pd.DataFrame(peak_normalized)
    df_peak_metrics.to_csv('engines/valuation/quant/peak_metrics_comparison.csv')
    print("Saved peak metrics comparison to CSV.")

    # Calculate correlation matrix of normalized indicators over time
    corr_matrix = df_normalized.corr(method='spearman')
    corr_matrix.to_csv('engines/valuation/quant/indicators_correlation.csv')
    print("Saved indicators correlation matrix to CSV.")

    # Analyze specifically how many indicators did NOT reach -1.5 or -1.8 in 2025 vs previous peaks
    print("\nIndicator Normalized Scores at Cycle Peaks:")
    print(df_peak_metrics)

    # Let's see which indicators were closest to -2.0 in 2025 vs 2017
    print("\nComparison of 2017 vs 2025 Top Metrics:")
    df_comp = pd.DataFrame({
        '2017 Peak': df_peak_metrics['2017 Peak'],
        '2025 Top Peak': df_peak_metrics['2025 Top Peak'],
        'Diff (2025 - 2017)': df_peak_metrics['2025 Top Peak'] - df_peak_metrics['2017 Peak']
    }).sort_values('Diff (2025 - 2017)', ascending=False)
    print(df_comp)

    # Calculate overall indicator correlation over time to check cycle correlation
    # We will compute the cross-correlation of the composite index over cycles
    df_price = pd.read_sql('SELECT date, close FROM btc_ohlc ORDER BY date ASC', conn)
    df_price['date'] = pd.to_datetime(df_price['date'])
    df_price.set_index('date', inplace=True)

    # Create composite index as mean of normalized indicators (ignoring aviv_nupl)
    composite = df_normalized.drop(columns=['aviv_nupl'], errors='ignore').mean(axis=1)
    df_composite = pd.DataFrame({'composite': composite}).join(df_price['close'].rename('price'), how='inner')
    df_composite.to_csv('engines/valuation/quant/composite_vs_price.csv')
    print("Saved composite vs price time-series to CSV.")

    conn.close()

if __name__ == '__main__':
    analyze_indicators()
