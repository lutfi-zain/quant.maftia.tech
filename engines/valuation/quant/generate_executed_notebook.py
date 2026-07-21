import nbformat as nbf
from nbconvert.preprocessors import ExecutePreprocessor
import os

def create_notebook():
    nb = nbf.v4.new_notebook()

    # Define cells
    cells = []

    # Title & Introduction
    cells.append(nbf.v4.new_markdown_cell("""# BTC On-Chain Valuation & Cycle Peak Analysis
### Quantitative Research into the October-November 2025 Top Cycle & Institutional Regime Shifts

**Research Scientist:** Claude (lz-quant-researcher & data science core)
**Date:** 2026-07-20

---

## Executive Summary
Historically, Bitcoin cycle peaks have been marked by retail-driven FOMO, extreme speculative leverage, and massive distribution of coins by Long-Term Holders (LTHs) to new retail market entrants. In the 2013 and 2017 cycle peaks, this market behavior drove **17 normalized indicators in the Valuation Studio** to their extreme overvalued bounds of **-2.0**.

However, during the **October-November 2025 top cycle** (where spot price peaked at **$124,672.41** on October 6, 2025), the valuation composite failed to reach these extreme levels. In fact:
- The average normalized indicator score was only **-0.209** (close to neutral).
- Only **2 out of 17** indicators reached extreme overvalued levels ($\le -1.8$).
- Key metrics like **MVRV** peaked at just **2.29** (compared to 4.48 in 2017 and 4.86 in 2013).
- **Long-Term Holder Supply Ratio** remained extremely high at **77.24%** (only 22.76% of supply was active/liquid), indicating very low coin distribution.

This notebook implements a data mining and exploratory data analysis (EDA) workflow to analyze the structural changes across Bitcoin cycles. We demonstrate that **massive institutional adoption (ETFs, corporate treasuries, nation-states)** and **volatility dampening** have fundamentally altered the market structure. High illiquidity has transitioned from a cyclical anomaly to the new baseline regime, rendering traditional cycle-top normalization thresholds obsolete without adaptive calibration.
"""))

    # Setup environment
    cells.append(nbf.v4.new_code_cell("""# Setup environment and import packages
import os
import sys
import sqlite3
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime
from scipy import stats

# Add project root to path for local imports
project_root = "/home/ubuntu/projects/quant.maftia.tech"
sys.path.append(os.path.join(project_root, "engines/valuation"))
from quant.components.bitview_client import fetch_series

# Configure plotting style
sns.set_theme(style="whitegrid", context="notebook", palette="muted")
plt.rcParams['figure.figsize'] = (12, 6)
plt.rcParams['font.size'] = 11
plt.rcParams['axes.labelsize'] = 12
plt.rcParams['axes.titlesize'] = 14
plt.rcParams['xtick.labelsize'] = 10
plt.rcParams['ytick.labelsize'] = 10

DB_PATH = os.path.join(project_root, "engines/valuation/database/metrics.db")
print("Environment initialized successfully.")
"""))

    # Load Data from Database
    cells.append(nbf.v4.new_markdown_cell("""## Section 1: Data Ingestion & Preprocessing
We load the pre-calculated normalized indicator values and spot prices from the SQLite database. We also fetch raw on-chain data (LTH Supply, realized capitalization, circulating supply, coindays destroyed) directly from the bitview.space API to analyze the underlying structural drivers.
"""))

    cells.append(nbf.v4.new_code_cell("""# Connect to SQLite database
conn = sqlite3.connect(DB_PATH)

# Load timeseries metrics
df_metrics_raw = pd.read_sql('SELECT date, metric_name, raw_value, normalized_value FROM timeseries_metrics', conn)
df_metrics_raw['date'] = pd.to_datetime(df_metrics_raw['date'], format='mixed', utc=True)

# Pivot data to have one column per metric
df_normalized = df_metrics_raw.pivot_table(index='date', columns='metric_name', values='normalized_value', aggfunc='mean')
df_raw = df_metrics_raw.pivot_table(index='date', columns='metric_name', values='raw_value', aggfunc='mean')

# Load spot prices
df_price = pd.read_sql('SELECT date, close FROM btc_ohlc ORDER BY date ASC', conn)
df_price['date'] = pd.to_datetime(df_price['date'], format='mixed', utc=True)
df_price.set_index('date', inplace=True)

print(f"Loaded {df_normalized.shape[0]} rows and {df_normalized.shape[1]} metrics from SQLite database.")
conn.close()
"""))

    cells.append(nbf.v4.new_code_cell("""# Fetch auxiliary on-chain series from bitview.space API
print("Fetching on-chain data from bitview.space API...")
try:
    lth_supply = fetch_series('lth_supply', start_date='2010-01-01')
    sth_supply = fetch_series('sth_supply', start_date='2010-01-01')
    total_supply = fetch_series('supply', start_date='2010-01-01')
    realized_cap = fetch_series('realized_cap', start_date='2010-01-01')
    coindays_destroyed_1m = fetch_series('coindays_destroyed_sum_1m', start_date='2010-01-01')

    # Process dates and set index
    dfs = []
    for name, df in [
        ('lth_supply', lth_supply),
        ('sth_supply', sth_supply),
        ('total_supply', total_supply),
        ('realized_cap', realized_cap),
        ('coindays_destroyed_1m', coindays_destroyed_1m)
    ]:
        df['date'] = pd.to_datetime(df['date'], format='mixed', utc=True)
        df.set_index('date', inplace=True)
        dfs.append(df['value'].rename(name))

    onchain = pd.concat(dfs, axis=1)
    print(f"Successfully fetched and aligned on-chain data. Shape: {onchain.shape}")
except Exception as e:
    print(f"Error fetching API data: {e}")
    # Fallback to local files if API fails
    onchain = pd.read_csv(os.path.join(project_root, 'engines/valuation/quant/onchain_cycle_data.csv'))
    onchain['date'] = pd.to_datetime(onchain['date'], format='mixed', utc=True)
    onchain.set_index('date', inplace=True)
    print("Loaded fallback data from local CSV.")
"""))

    # Compute key ratios
    cells.append(nbf.v4.new_code_cell("""# Compute key structural metrics
onchain['lth_ratio'] = onchain['lth_supply'] / onchain['total_supply']
onchain['sth_ratio'] = onchain['sth_supply'] / onchain['total_supply']
onchain['active_ratio'] = 1.0 - onchain['lth_ratio']
onchain['illiquidity_factor'] = onchain['lth_ratio'] / onchain['active_ratio']

# 4-Year rolling mean of Illiquidity Factor (1460 days) to calculate IIP modifier
onchain['illiquidity_4y_mean'] = onchain['illiquidity_factor'].rolling(1460, min_periods=365).mean()
onchain['iip_multiplier'] = onchain['illiquidity_factor'] / onchain['illiquidity_4y_mean']
onchain['iip_penalty'] = (onchain['iip_multiplier']**2 - 1.0).clip(lower=0.0)

# Merge price & calculate realized price and MVRV
onchain = onchain.join(df_price['close'].rename('spot_price'), how='left')
onchain['realized_price'] = onchain['realized_cap'] / onchain['total_supply']
onchain['mvrv'] = onchain['spot_price'] / onchain['realized_price']

# Add rolling volatility
onchain['log_ret'] = np.log(onchain['spot_price'] / onchain['spot_price'].shift(1))
onchain['vol_1y'] = onchain['log_ret'].rolling(365).std() * np.sqrt(365)

print("Key structural metrics successfully computed.")
onchain.tail(3)
"""))

    # Peak Identification
    cells.append(nbf.v4.new_markdown_cell("""## Section 2: Cycle Peak Comparison
We define the dates of the major historical peaks and extract the state of the market (spot price, realized price, MVRV, LTH supply ratio, volatility, and coindays destroyed) at each peak.
"""))

    cells.append(nbf.v4.new_code_cell("""# Define exact cycle peaks
peaks = {
    '2013 Peak': pd.to_datetime('2013-12-04', utc=True),
    '2017 Peak': pd.to_datetime('2017-12-16', utc=True),
    '2021 Apr Peak': pd.to_datetime('2021-04-15', utc=True),
    '2021 Nov Peak': pd.to_datetime('2021-11-09', utc=True),
    '2024 Mar Peak': pd.to_datetime('2024-03-13', utc=True),
    '2025 Top Peak': pd.to_datetime('2025-10-06', utc=True)
}

peak_summaries = []
for label, p_date in peaks.items():
    closest_dt = onchain.index[np.argmin(np.abs(onchain.index - p_date))]
    row = onchain.loc[closest_dt]

    # Query database metrics for this date
    p_date_str = closest_dt.strftime('%Y-%m-%d')
    metrics_at_peak = df_normalized.loc[closest_dt]

    total_indicators = len(metrics_at_peak.dropna())
    extreme_m2 = sum(metrics_at_peak <= -1.8)
    extreme_m1_5 = sum(metrics_at_peak <= -1.5)
    mean_normalized = metrics_at_peak.drop('aviv_nupl', errors='ignore').mean()

    peak_summaries.append({
        'Peak': label,
        'Date': p_date_str,
        'Spot Price': row['spot_price'],
        'Realized Price': row['realized_price'],
        'MVRV': row['mvrv'],
        '1Y Ann Volatility': row['vol_1y'],
        'LTH Supply Ratio': row['lth_ratio'],
        'Active Ratio': row['active_ratio'],
        'Illiquidity Factor': row['illiquidity_factor'],
        'IIP Penalty': row['iip_penalty'],
        'Coindays Destroyed (1M, M)': row['coindays_destroyed_1m'] / 1e6,
        'Mean Indicator Score': mean_normalized,
        'Indicators <= -1.8': f"{extreme_m2} / {total_indicators}",
        'Indicators <= -1.5': f"{extreme_m1_5} / {total_indicators}"
    })

df_peaks_summary = pd.DataFrame(peak_summaries)
df_peaks_summary
"""))

    # Analysis of Indicator Behaviour
    cells.append(nbf.v4.new_markdown_cell("""## Section 3: Indicator-Level Analysis (2017 Peak vs 2025 Top Peak)
Let's see how each of the 17 indicators behaved at the 2017 Peak compared to the 2025 Top Peak. This will highlight which indicators failed to reach extreme values and why.
"""))

    cells.append(nbf.v4.new_code_cell("""# Extract indicators at the 2017 and 2025 peaks
p2017 = df_normalized.loc[df_normalized.index[np.argmin(np.abs(df_normalized.index - peaks['2017 Peak']))]]
p2025 = df_normalized.loc[df_normalized.index[np.argmin(np.abs(df_normalized.index - peaks['2025 Top Peak']))]]

df_compare_indicators = pd.DataFrame({
    '2017 Peak': p2017,
    '2025 Top Peak': p2025,
    'Difference (2025 - 2017)': p2025 - p2017
}).sort_values('Difference (2025 - 2017)', ascending=False)

df_compare_indicators
"""))

    # Plot Comparison of Indicators
    cells.append(nbf.v4.new_code_cell("""# Visualize the normalized scores at 2017 Peak vs 2025 Top Peak
plt.figure(figsize=(14, 8))
x = np.arange(len(df_compare_indicators))
width = 0.35

plt.bar(x - width/2, df_compare_indicators['2017 Peak'], width, label='2017 Peak (Dec 2017)', color='#2c3e50')
plt.bar(x + width/2, df_compare_indicators['2025 Top Peak'], width, label='2025 Top Peak (Oct 2025)', color='#e74c3c')

plt.axhline(y=-1.8, color='red', linestyle='--', alpha=0.7, label='Extreme Overvalued Threshold (-1.8)')
plt.axhline(y=0.0, color='gray', linestyle=':', alpha=0.5)

plt.xlabel('Metric Name')
plt.ylabel('Normalized Score')
plt.title('Normalized Scores of 17 Valuation Studio Indicators: 2017 Peak vs 2025 Top Peak')
plt.xticks(x, df_compare_indicators.index, rotation=90)
plt.legend(loc='lower right')
plt.tight_layout()
plt.show()
"""))

    # Volatility Dampening
    cells.append(nbf.v4.new_markdown_cell("""## Section 4: Volatility Dampening & Asset Maturation
A key factor behind the failure of longer-term technical/risk indicators to reach extremes is **volatility dampening**. As institutional capital moves in, Bitcoin's annualized volatility has consistently fallen at each successive peak.
"""))

    cells.append(nbf.v4.new_code_cell("""# Plot spot price and rolling 1Y volatility over time
fig, ax1 = plt.subplots(figsize=(14, 7))

color = '#2c3e50'
ax1.set_xlabel('Date')
ax1.set_ylabel('BTC Spot Price ($)', color=color)
ax1.plot(onchain.index, onchain['spot_price'], color=color, alpha=0.8, label='BTC Price')
ax1.tick_params(axis='y', labelcolor=color)
ax1.set_yscale('log')

ax2 = ax1.twinx()
color = '#e67e22'
ax2.set_ylabel('1Y Annualized Volatility', color=color)
ax2.plot(onchain.index, onchain['vol_1y'], color=color, alpha=0.6, linestyle='--', label='1Y Ann Volatility')
ax2.tick_params(axis='y', labelcolor=color)

# Add peak markers
for label, p_date in peaks.items():
    if p_date in onchain.index:
        y_val = onchain.loc[p_date, 'spot_price']
        ax1.scatter(p_date, y_val, color='red', s=80, zorder=5)
        ax1.annotate(label, (p_date, y_val), textcoords="offset points", xytext=(0,10), ha='center', fontweight='bold')

plt.title('Bitcoin Price (Log Scale) and 1Y Annualized Volatility Across Cycles')
fig.tight_layout()
plt.show()
"""))

    # LTH Supply and Illiquidity Shift
    cells.append(nbf.v4.new_markdown_cell("""## Section 5: Long-Term Holder Illiquidity Shift
The most dramatic difference between historical peaks (2013, 2017) and recent tops (2021, 2025) is the percentage of supply held by **Long-Term Holders (LTHs)**. In 2017, LTHs sold down to 53% of supply. In 2025, they held **77.2%**, meaning the liquid/active market was extremely thin.
"""))

    cells.append(nbf.v4.new_code_cell("""# Plot LTH vs STH Supply Ratios over time
plt.figure(figsize=(14, 7))
plt.plot(onchain.index, onchain['lth_ratio'], color='#2980b9', linewidth=2, label='Long-Term Holder (LTH) Supply %')
plt.plot(onchain.index, onchain['active_ratio'], color='#e74c3c', linewidth=2, linestyle='--', label='Active/STH Supply %')

# Draw peak vertical lines
for label, p_date in peaks.items():
    if p_date in onchain.index:
        lth_val = onchain.loc[p_date, 'lth_ratio']
        plt.axvline(x=p_date, color='gray', linestyle=':', alpha=0.5)
        plt.scatter(p_date, lth_val, color='black', s=50, zorder=5)
        plt.annotate(f"{label}\\n{lth_val:.1%}", (p_date, lth_val), textcoords="offset points", xytext=(10,-10), ha='left', fontsize=9)

plt.title('Bitcoin Long-Term Holder (LTH) vs Active Supply Ratios')
plt.xlabel('Date')
plt.ylabel('Supply Share %')
plt.legend(loc='center left')
plt.show()
"""))

    # MVRV and Realized Price Inflow
    cells.append(nbf.v4.new_markdown_cell("""## Section 6: Realized Price Inflows & MVRV Ceiling Collapse
Realized Price represents the average cost basis of all coins. Institutional inflows (such as ETFs and corporate treasuries) buy coins at high prices, which raises the Realized Price extremely fast.

Because the average cost basis rises so fast during the bull market, the spot price cannot rise far above it in percentage terms. This leads to a **collapse of the MVRV cycle ceiling**.
"""))

    cells.append(nbf.v4.new_code_cell("""# Plot Spot Price vs Realized Price
plt.figure(figsize=(14, 7))
plt.plot(onchain.index, onchain['spot_price'], color='#2c3e50', linewidth=2, label='Spot Price')
plt.plot(onchain.index, onchain['realized_price'], color='#8e44ad', linewidth=2, label='Realized Price (Average Cost Basis)')

for label, p_date in peaks.items():
    if p_date in onchain.index:
        spot_val = onchain.loc[p_date, 'spot_price']
        mvrv_val = onchain.loc[p_date, 'mvrv']
        plt.axvline(x=p_date, color='gray', linestyle=':', alpha=0.5)
        plt.scatter(p_date, spot_val, color='red', s=50, zorder=5)
        plt.annotate(f"{label}\\nMVRV: {mvrv_val:.2f}", (p_date, spot_val), textcoords="offset points", xytext=(0,10), ha='center', fontsize=9)

plt.title('Bitcoin Spot Price vs Realized Price (Log Scale)')
plt.xlabel('Date')
plt.ylabel('Price ($)')
plt.yscale('log')
plt.legend(loc='upper left')
plt.show()
"""))

    # IIP Penalty Shock vs New Normal
    cells.append(nbf.v4.new_markdown_cell("""## Section 7: Institutional Illiquidity Premium (IIP) - Shock vs New Normal
In 2021, the sudden transition to high LTH holdings was a **deviation/shock** from the historical mean, which triggered the Institutional Illiquidity Premium (IIP) Penalty.

However, by 2025, high illiquidity has lasted for 4 years and became the **new baseline**. Thus, the rolling 4Y average of the illiquidity factor caught up to the spot values, resulting in an IIP Penalty of **0.00**.
"""))

    cells.append(nbf.v4.new_code_cell("""# Plot Illiquidity Factor and its 4Y Rolling Mean
plt.figure(figsize=(14, 7))
plt.plot(onchain.index, onchain['illiquidity_factor'], color='#2980b9', label='Illiquidity Factor (LTH / Active)')
plt.plot(onchain.index, onchain['illiquidity_4y_mean'], color='#16a085', linestyle='--', label='4Y Rolling Mean (Baseline)')

ax_twin = plt.twinx()
ax_twin.fill_between(onchain.index, onchain['iip_penalty'], color='#e74c3c', alpha=0.2, label='IIP Penalty')
ax_twin.set_ylabel('IIP Penalty')

plt.title('Illiquidity Factor, 4Y Baseline, and the Resulting IIP Penalty')
lines1, labels1 = plt.gca().get_legend_handles_labels()
lines2, labels2 = ax_twin.get_legend_handles_labels()
plt.legend(lines1 + lines2, labels1 + labels2, loc='upper left')
plt.show()
"""))

    # Correlation Matrix of Indicators
    cells.append(nbf.v4.new_markdown_cell("""## Section 8: Indicator Cross-Correlation & Cycle Similarity
We calculate the Spearman Rank Correlation of the normalized indicators over history to check how closely they move together. We also show how the Composite Valuation Index behaved across cycles.
"""))

    cells.append(nbf.v4.new_code_cell("""# Load indicator correlation matrix
df_corr = pd.read_csv('indicators_correlation.csv')
if 'metric_name' in df_corr.columns:
    df_corr.set_index('metric_name', inplace=True)
elif 'Unnamed: 0' in df_corr.columns:
    df_corr.set_index('Unnamed: 0', inplace=True)

# Plot Correlation Heatmap
plt.figure(figsize=(14, 12))
sns.heatmap(df_corr, annot=True, fmt=".2f", cmap="coolwarm", vmin=-1.0, vmax=1.0, square=True)
plt.title('Spearman Rank Correlation Matrix of 17 Normalized Indicators')
plt.tight_layout()
plt.show()
"""))

    # Composite Index Over Cycles
    cells.append(nbf.v4.new_code_cell("""# Load composite vs price
df_comp_price = pd.read_csv('composite_vs_price.csv')
df_comp_price['date'] = pd.to_datetime(df_comp_price['date'], format='mixed', utc=True)
df_comp_price.set_index('date', inplace=True)

# Plot Composite Index vs Price
fig, ax1 = plt.subplots(figsize=(14, 7))

color = '#2c3e50'
ax1.set_xlabel('Date')
ax1.set_ylabel('BTC Spot Price ($)', color=color)
ax1.plot(df_comp_price.index, df_comp_price['price'], color=color, alpha=0.8, label='BTC Price')
ax1.tick_params(axis='y', labelcolor=color)
ax1.set_yscale('log')

ax2 = ax1.twinx()
color = '#e74c3c'
ax2.set_ylabel('Composite Valuation Index ([-2, 2])', color=color)
ax2.plot(df_comp_price.index, df_comp_price['composite'], color=color, alpha=0.6, label='Composite Index')
ax2.tick_params(axis='y', labelcolor=color)

# Overvalued/Undervalued fills
ax2.axhline(y=-1.5, color='red', linestyle='--', alpha=0.3)
ax2.axhline(y=1.5, color='green', linestyle='--', alpha=0.3)

plt.title('Composite Valuation Index (Mean of Normalized Indicators) vs BTC Price')
fig.tight_layout()
plt.show()
"""))

    # Skeptic's Corner & Conclusion
    cells.append(nbf.v4.new_markdown_cell("""## Section 9: Skeptic's Corner & Quantitative Recommendations
As quantitative researchers, we must view our results with deep skepticism:

1. **Why the traditional composite failed in 2025:**
   - **Regime Blindness:** Normalizing to historical bounds assuming stationary distributions (e.g. MVRV > 4 is a top) fails when the underlying distribution undergoes a regime shift due to structural changes (ETF inflows).
   - **Baseline Drift in IIP:** The IIP modifier, while effective in 2021, failed in 2025 because it is relative to a rolling 4Y average. A permanent regime shift to illiquidity eventually shifts the rolling 4Y average to match the spot level, neutralizing the relative penalty.

2. **Alternative Strategies & Recommendations:**
   - **Vol-Adjusted Thresholds:** We should scale the overvalued/undervalued thresholds dynamically using rolling volatility. Since volatility has dropped by 50%, the threshold for "bubble risk" should drop from MVRV of 4.5 to MVRV of 2.2-2.5.
   - **Illiquidity-Adjusted Z-Scores:** Rather than using raw MVRV, we should normalize MVRV using a Z-score where the mean and standard deviation are adjusted for the LTH supply ratio:
     $$MVRV_{adj} = MVRV \times (1 + \lambda \times LTH\_Ratio)$$
     This would structurally boost valuation scores in highly illiquid regimes.

---
*End of Report.*
"""))

    nb['cells'] = cells

    # Write notebook
    with open('engines/valuation/quant/valuation_cycle_analysis.ipynb', 'w') as f:
        nbf.write(nb, f)

    print("Jupyter Notebook created at: engines/valuation/quant/valuation_cycle_analysis.ipynb")

if __name__ == '__main__':
    create_notebook()
