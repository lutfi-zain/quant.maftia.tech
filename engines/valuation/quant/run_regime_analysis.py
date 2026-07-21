import os
import sys
import pandas as pd
import numpy as np

def analyze_regimes():
    # Load on-chain data generated in run_peaks_analysis
    onchain = pd.read_csv('engines/valuation/quant/onchain_cycle_data.csv')
    onchain['date'] = pd.to_datetime(onchain['date'])
    onchain.set_index('date', inplace=True)

    # 1. Volatility Dampening Analysis
    # Let's compute rolling 1-year (365 days) volatility of log returns
    onchain['log_ret'] = np.log(onchain['spot_price'] / onchain['spot_price'].shift(1))
    onchain['vol_1y'] = onchain['log_ret'].rolling(365).std() * np.sqrt(365)

    # Let's look at volatility at peak dates
    peaks = {
        '2013-12-04': '2013 Peak',
        '2017-12-16': '2017 Peak',
        '2021-04-15': '2021 Apr Peak',
        '2021-11-09': '2021 Nov Peak',
        '2024-03-13': '2024 Mar Peak',
        '2025-10-06': '2025 Top Peak'
    }

    print("Volatility and Holder Ratios at Peaks:")
    vol_stats = []
    for date_str, label in peaks.items():
        dt = pd.to_datetime(date_str, utc=True)
        closest_dt = onchain.index[np.argmin(np.abs(onchain.index - dt))]
        row = onchain.loc[closest_dt]
        vol_stats.append({
            'Peak': label,
            'Date': closest_dt.strftime('%Y-%m-%d'),
            'Spot Price': row['spot_price'],
            'Realized Price': row['realized_price'],
            'MVRV': row['mvrv'],
            '1Y Ann Volatility': row['vol_1y'],
            'LTH Supply Ratio': row['lth_ratio'],
            'Active Supply Ratio': row['active_ratio'],
            'Illiquidity Factor': row['illiquidity_factor'],
            'IIP Penalty': row['iip_penalty'],
            'Coindays Destroyed (1M)': row['coindays_destroyed_1m'] / 1e6
        })

    df_vol = pd.DataFrame(vol_stats)
    df_vol.to_csv('engines/valuation/quant/peak_vol_holder_stats.csv', index=False)
    print(df_vol)

    # 2. Institutional Illiquidity Premium (IIP) Analysis
    # Let's show how the composite score is affected by the IIP Penalty
    # We will simulate:
    # Adjusted_Composite = Raw_Composite - IIP_Penalty (if scale is top = -2, bottom = +2)
    # Wait, in the project:
    # \"When a normalized component score (bounded [-2.0, +2.0]) is calculated, if the scale is defined where high values are tops (>= +1.50 = bubble risk), add the Penalty directly to the score. If the scale is inverted (negative is top), subtract the Penalty.\"
    # In our DB:
    # normalized_values: overvalued/top = -2.0, undervalued/bottom = +2.0
    # Therefore, negative is top, so we SUBTRACT the Penalty from the score to push it further negative (towards -2.0).
    # E.g., if Raw_Composite = -0.2, and Penalty = 0.9, then Adjusted_Composite = -0.2 - 0.9 = -1.1.
    # Let's verify how much IIP Penalty would apply across history.
    onchain['adjusted_mvrv_z_sim'] = -2.0 # Placeholder
    # Let's save a summary of IIP Penalty over time
    # Check if illiquidity_cum_mean is in the columns, if not map from peaks analysis
    if 'illiquidity_cum_mean' in onchain.columns:
        onchain[['lth_ratio', 'active_ratio', 'illiquidity_factor', 'illiquidity_cum_mean', 'iip_multiplier', 'iip_penalty']].to_csv('engines/valuation/quant/iip_time_series.csv')
    else:
        onchain[['lth_ratio', 'active_ratio', 'illiquidity_factor', 'illiquidity_4y_mean', 'iip_multiplier', 'iip_penalty']].to_csv('engines/valuation/quant/iip_time_series.csv')
    print("Saved IIP time series to CSV.")

if __name__ == '__main__':
    analyze_regimes()
