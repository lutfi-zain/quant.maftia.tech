# Task for researcher

You are a **Data Science Researcher** performing correlation mining and matrix analysis on Bitcoin valuation metrics across all historical cycles.

## Context
We have a SQLite database at `/home/ubuntu/projects/quant.maftia.tech/data/maftia_quant.db` with these tables:
- `unified_daily_analytics`: 47 columns including date, btc_price, valuation_composite, lttd_regime, lttd_score, mttd_imo, ichimoku_imo, mvo_pillar_fundamental/technical/sentiment, etc.
- `indicator_scores`: Individual indicator normalized scores (date, metric_name, raw_value, normalized_score)
- `onchain_metrics`: Raw onchain metric values
- `metric_config`: 21 rows of threshold configurations
- `master_ohlcv`: Daily OHLCV price data

The Valuation Composite is the average of ~14 indicators (17 total minus 3 excluded: aviv_nupl, williams_r, fear_greed_cmc), each normalized to [-2, +2], then rescaled via expanding-window percentile method.

## Your Mission — Write and Execute Analysis Scripts

### Step 1: Database Schema Discovery
Write a Python script to `/home/ubuntu/projects/quant.maftia.tech/tmp/schema_discovery.py` that:
```python
import sqlite3
import pandas as pd

db = sqlite3.connect('/home/ubuntu/projects/quant.maftia.tech/data/maftia_quant.db')

# 1. Show all tables
tables = db.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
print("=== TABLES ===")
for t in tables: print(t[0])

# 2. For each table, show schema and row count
for t in tables:
    name = t[0]
    cols = db.execute(f"PRAGMA table_info({name})").fetchall()
    count = db.execute(f"SELECT COUNT(*) FROM {name}").fetchone()[0]
    print(f"\n=== {name} ({count} rows) ===")
    for c in cols: print(f"  {c[1]} ({c[2]})")

# 3. indicator_scores: unique metrics, date ranges, completeness
print("\n=== INDICATOR SCORES INVENTORY ===")
df_is = pd.read_sql("SELECT * FROM indicator_scores", db)
print(f"Total rows: {len(df_is)}")
print(f"Columns: {list(df_is.columns)}")
if 'metric_name' in df_is.columns:
    inventory = df_is.groupby('metric_name').agg(
        count=('date', 'count'),
        min_date=('date', 'min'),
        max_date=('date', 'max'),
        null_count=('normalized_score', lambda x: x.isna().sum())
    ).sort_values('count', ascending=False)
    print(inventory)

# 4. unified_daily_analytics: sample and range
print("\n=== UNIFIED DAILY ANALYTICS ===")
df_uda = pd.read_sql("SELECT * FROM unified_daily_analytics ORDER BY date LIMIT 3", db)
print(f"Columns: {list(df_uda.columns)}")
date_range = db.execute("SELECT MIN(date), MAX(date), COUNT(*) FROM unified_daily_analytics").fetchone()
print(f"Date range: {date_range[0]} to {date_range[1]}, {date_range[2]} rows")

db.close()
```

Run this script and report results.

### Step 2: Cycle Peak/Bottom Fingerprint Analysis
Write and run `/home/ubuntu/projects/quant.maftia.tech/tmp/cycle_fingerprints.py`:
```python
import sqlite3
import pandas as pd

db = sqlite3.connect('/home/ubuntu/projects/quant.maftia.tech/data/maftia_quant.db')

# Load indicator scores
df_is = pd.read_sql("SELECT * FROM indicator_scores WHERE normalized_score IS NOT NULL", db)

# Find cycle peak dates (highest price per cycle)
cycle_peaks = {
    '2013': ('2013-11-29', 1150),
    '2017': ('2017-12-16', 19800),
    '2021a': ('2021-04-14', 64800),
    '2021b': ('2021-11-10', 69000),
    '2024': ('2024-03-13', 73000),
    '2025': ('2025-10-06', 124658),
}

cycle_bottoms = {
    '2015': ('2015-01-14', 200),
    '2018': ('2018-12-15', 3200),
    '2022': ('2022-11-21', 15781),
}

print("=== CYCLE PEAK FINGERPRINTS ===")
for cycle, (date, price) in cycle_peaks.items():
    print(f"\n--- {cycle} Peak ({date}, ${price:,.0f}) ---")
    day_scores = df_is[df_is['date'] == date]
    if day_scores.empty:
        # Try nearby dates
        day_scores = df_is[(df_is['date'] >= date) & (df_is['date'] <= date[:8] + '20')]
        if not day_scores.empty:
            date = day_scores['date'].iloc[0]
            day_scores = df_is[df_is['date'] == date]
            print(f"  (using nearby date: {date})")
    
    if not day_scores.empty:
        for _, row in day_scores.iterrows():
            print(f"  {row['metric_name']:30s} raw={row.get('raw_value', 'N/A'):>10} norm={row['normalized_score']:>8.3f}")
    else:
        print("  No indicator scores found for this date")

print("\n=== CYCLE BOTTOM FINGERPRINTS ===")
for cycle, (date, price) in cycle_bottoms.items():
    print(f"\n--- {cycle} Bottom ({date}, ${price:,.0f}) ---")
    day_scores = df_is[df_is['date'] == date]
    if day_scores.empty:
        day_scores = df_is[(df_is['date'] >= date) & (df_is['date'] <= date[:8] + '20')]
        if not day_scores.empty:
            date = day_scores['date'].iloc[0]
            day_scores = df_is[df_is['date'] == date]
            print(f"  (using nearby date: {date})")
    if not day_scores.empty:
        for _, row in day_scores.iterrows():
            print(f"  {row['metric_name']:30s} raw={row.get('raw_value', 'N/A'):>10} norm={row['normalized_score']:>8.3f}")

db.close()
```

### Step 3: Correlation Matrix Mining
Write and run `/home/ubuntu/projects/quant.maftia.tech/tmp/correlation_matrix.py`:
```python
import sqlite3
import pandas as pd
import numpy as np

db = sqlite3.connect('/home/ubuntu/projects/quant.maftia.tech/data/maftia_quant.db')

# Load all indicator scores
df_is = pd.read_sql("SELECT date, metric_name, normalized_score FROM indicator_scores WHERE normalized_score IS NOT NULL", db)

# Pivot to wide format
pivot = df_is.pivot_table(index='date', columns='metric_name', values='normalized_score', aggfunc='first')
print(f"Pivot shape: {pivot.shape}")
print(f"Metrics: {list(pivot.columns)}")
print(f"Date range: {pivot.index.min()} to {pivot.index.max()}")
print(f"Completeness (% non-null per metric):")
print((pivot.notna().mean() * 100).sort_values(ascending=False))

# Correlation matrix
corr = pivot.corr()
print("\n=== TOP 15 STRONGEST CORRELATIONS ===")
# Get upper triangle
mask = np.triu(np.ones_like(corr, dtype=bool), k=1)
corr_pairs = corr.where(mask).stack().reset_index()
corr_pairs.columns = ['Metric_A', 'Metric_B', 'Correlation']
corr_pairs = corr_pairs.sort_values('Correlation', key=abs, ascending=False)
print(corr_pairs.head(15).to_string(index=False))

print("\n=== TOP 10 NEGATIVE CORRELATIONS ===")
print(corr_pairs.tail(10).to_string(index=False))

# PCA on correlation matrix
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

# Drop columns with too many NaNs
pivot_clean = pivot.dropna(axis=1, thresh=int(len(pivot)*0.5))
pivot_filled = pivot_clean.fillna(pivot_clean.median())

scaler = StandardScaler()
scaled = scaler.fit_transform(pivot_filled)

pca = PCA(n_components=min(10, len(pivot_clean.columns)))
pca.fit(scaled)

print("\n=== PCA COMPONENTS ===")
for i, (var, cum) in enumerate(zip(pca.explained_variance_ratio_, np.cumsum(pca.explained_variance_ratio_))):
    print(f"PC{i+1}: {var:.3f} (cumulative: {cum:.3f})")
    # Top 3 loadings
    loadings = pd.Series(pca.components_[i], index=pivot_clean.columns).abs().sort_values(ascending=False)
    top3 = loadings.head(3)
    for name, val in top3.items():
        direction = "+" if pca.components_[i][pivot_clean.columns.get_loc(name)] > 0 else "-"
        print(f"  {direction} {name}: {val:.3f}")

# 2025 gap analysis
print("\n=== 2025 GAP ANALYSIS ===")
# Compare 2024-03-13 peak (composite=-2.0) vs 2025-10-06 peak (composite=-0.27)
for label, target_date in [('2024-03-13 (comp=-2.0)', '2024-03-13'), ('2025-10-06 (comp=-0.27)', '2025-10-06')]:
    print(f"\n--- {label} ---")
    # Get scores within ±3 days
    scores = df_is[(df_is['date'] >= target_date[:8]+'10') & (df_is['date'] <= target_date[:8]+'20')]
    if scores.empty:
        scores = df_is[df_is['date'] == target_date]
    if not scores.empty:
        latest = scores.groupby('metric_name').last().reset_index()
        for _, row in latest.iterrows():
            print(f"  {row['metric_name']:30s} norm={row['normalized_score']:>8.3f}")
    else:
        print(f"  No data near {target_date}")

db.close()
```

### Step 4: Content Matrix Determinism
Write and run `/home/ubuntu/projects/quant.maftia.tech/tmp/content_matrix.py`:
```python
import sqlite3
import pandas as pd
import numpy as np

db = sqlite3.connect('/home/ubuntu/projects/quant.maftia.tech/data/maftia_quant.db')

# Load data
df_is = pd.read_sql("SELECT date, metric_name, normalized_score FROM indicator_scores WHERE normalized_score IS NOT NULL", db)
pivot = df_is.pivot_table(index='date', columns='metric_name', values='normalized_score', aggfunc='first')
pivot_clean = pivot.dropna(axis=1, thresh=int(len(pivot)*0.5)).fillna(0)

# Correlation matrix
corr = pivot_clean.corr()

# Find "determinism" pairs — metrics where knowing A gives high confidence about B
print("=== CORRELATION DETERMINISM MATRIX ===")
print("(If Metric A = extreme, what does Metric B look like?)\n")

key_metrics = ['mvrv_z', 'aviv_ratio', 'pi_cycle_top', 'fear_greed_og', 
               'ahr999', 'two_year_ma', 'vpli', 'lth_sth_sopr_ratio',
               'terminal_price_ratio', 'risk_metrics', 'sharpe_ratio_52w', 'dvrsi']
available = [m for m in key_metrics if m in pivot_clean.columns]

print(f"{'':30s}", end='')
for m in available:
    print(f"{m[:12]:>14s}", end='')
print()

for m1 in available:
    print(f"{m1:30s}", end='')
    for m2 in available:
        if m1 == m2:
            print(f"{'---':>14s}", end='')
        else:
            r = corr.loc[m1, m2]
            print(f"{r:>14.3f}", end='')
    print()

# Cross-correlation lag analysis (which leads which)
print("\n=== CROSS-CORRELATION LAG ANALYSIS ===")
print("(Positive lag = Metric A leads Metric B)\n")
for m1 in available[:6]:
    best_lag = 0
    best_corr = 0
    for lag in range(-30, 31):
        shifted = pivot_clean[m1].shift(lag)
        valid = pd.DataFrame({'a': shifted, 'b': pivot_clean[m2]}).dropna()
        if len(valid) > 100:
            r = valid['a'].corr(valid['b'])
            if abs(r) > abs(best_corr):
                best_corr = r
                best_lag = lag
    print(f"  {m1:25s} best lag: {best_lag:+3d} days (r={best_corr:.3f})")

# Cycle-extreme correlation (only during top 10% and bottom 10% of price)
print("\n=== CORRELATION AT CYCLE EXTREMES ===")
df_ohlc = pd.read_sql("SELECT date, close FROM master_ohlcv", db)
df_ohlc['date'] = pd.to_datetime(df_ohlc['date']).dt.strftime('%Y-%m-%dT00:00:00Z')
merged = pivot_clean.copy()
merged['date'] = merged.index
merged = merged.merge(df_ohlc, on='date', how='left')

q90 = merged['close'].quantile(0.9)
q10 = merged['close'].quantile(0.1)

top10 = merged[merged['close'] >= q90][available]
bot10 = merged[merged['close'] <= q10][available]

if len(top10) > 10:
    corr_top = top10.corr()
    corr_bot = bot10.corr() if len(bot10) > 10 else None
    
    print(f"\nTop 10% price ({len(top10)} days, price >= ${q90:,.0f}):")
    for m1 in available[:4]:
        for m2 in available[4:8]:
            if m1 != m2:
                print(f"  {m1} <-> {m2}: r={corr_top.loc[m1,m2]:.3f}")
    
    if corr_bot is not None:
        print(f"\nBottom 10% price ({len(bot10)} days, price <= ${q10:,.0f}):")
        for m1 in available[:4]:
            for m2 in available[4:8]:
                if m1 != m2:
                    print(f"  {m1} <-> {m2}: r={corr_bot.loc[m1,m2]:.3f}")

db.close()
```

Run ALL FOUR scripts and report the complete output. This is critical data for building the video content matrix.

Confidence: HIGH (direct database access + code execution)


---
**Output:**
Write your findings to exactly this path: /home/ubuntu/projects/quant.maftia.tech/.pi-subagents/artifacts/outputs/0ce75e73/research.md
This path is authoritative for this run.
Ignore any other output filename or output path mentioned elsewhere, including output destinations in the base agent prompt, system prompt, or task instructions.

## Acceptance Contract
Acceptance level: attested
Completion is not accepted from prose alone. End with a structured acceptance report.

Criteria:
- criterion-1: Return concrete findings with file paths and severity when applicable

Required evidence: review-findings, residual-risks

Finish with a fenced JSON block tagged `acceptance-report` in this shape:
Use empty arrays when no items apply; array fields contain strings unless object entries are shown.
`criteriaSatisfied[].status` must be exactly one of: satisfied, not-satisfied, not-applicable.
`commandsRun[].result` must be exactly one of: passed, failed, not-run.
`manualNotes` and `notes` are optional strings; an empty string means no note and does not satisfy `manual-notes` evidence.
```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "specific proof"
    }
  ],
  "changedFiles": [
    "src/file.ts"
  ],
  "testsAddedOrUpdated": [
    "test/file.test.ts"
  ],
  "commandsRun": [
    {
      "command": "command",
      "result": "passed",
      "summary": "short result"
    }
  ],
  "validationOutput": [
    "validation output or concise summary"
  ],
  "residualRisks": [
    "none"
  ],
  "noStagedFiles": true,
  "diffSummary": "short description of the diff",
  "reviewFindings": [
    "blocker: file.ts:12 - issue found, or no blockers"
  ],
  "manualNotes": "anything else the parent should know"
}
```