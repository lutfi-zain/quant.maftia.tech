# Valuation Composite Score — Full Architecture Investigation

## 1. Component Registry (17 Components)

**File:** `engines/valuation/quant/components/registry.py` (lines 1–26)  
Dynamic discovery via `discover_components()` scans `quant/components/*.py`, imports all `BaseComponent` subclasses, sorts by class name. No manual registration needed.

### Active Components (17 total)

| # | Class Name | METRIC_NAME | CATEGORY | Description |
|---|-----------|-------------|----------|-------------|
| 1 | Ahr999Component | `ahr999` | technical | AHR999 Multiple |
| 2 | AvivNuplComponent | `aviv_nupl` | fundamental | AVIV NUPL (excluded from composite) |
| 3 | AvivRatioComponent | `aviv_ratio` | fundamental | AVIV Ratio |
| 4 | CvddRatioComponent | `cvdd_ratio` | fundamental | CVDD Ratio |
| 5 | DvrsiComponent | `dvrsi` | technical | DVRSI |
| 6 | FearGreedCmcComponent | `fear_greed_cmc` | sentiment | Fear & Greed CMC (excluded from composite) |
| 7 | FearGreedOgComponent | `fear_greed_og` | sentiment | Fear & Greed OG |
| 8 | LthSthSoprRatioComponent | `lth_sth_sopr_ratio` | fundamental | LTH/STH SOPR Ratio |
| 9 | MvrvZComponent | `mvrv_z` | fundamental | MVRV Z-Score |
| 10 | PiCycleTopComponent | `pi_cycle_top` | technical | Pi Cycle Top |
| 11 | RiskMetricsComponent | `risk_metrics` | technical | Risk Metrics |
| 12 | SharpeRatio52wComponent | `sharpe_ratio_52w` | technical | Sharpe Ratio 52-Week |
| 13 | TerminalPriceRatioComponent | `terminal_price_ratio` | fundamental | Terminal Price Ratio |
| 14 | TwoYearMaComponent | `two_year_ma` | technical | Two-Year MA |
| 15 | UnrealizedSellRiskComponent | `unrealized_sell_risk` | fundamental | Unrealized Sell-Side Risk |
| 16 | VpliComponent | `vpli` | technical | VPLI |
| 17 | WilliamsRComponent | `williams_r` | technical | Williams %R (excluded from composite) |

**Excluded from composite:** `aviv_nupl`, `williams_r`, `fear_greed_cmc` — hardcoded in the SQL query in `run_report_pipeline.py:47` and `audit/composite.py:32`.

---

## 2. Normalization Logic

### 2.1 Per-Component Normalization (`quant/components/normalization.py`)

**File:** `engines/valuation/quant/components/normalization.py` (lines 1–193)

Each component's `normalize()` method calls `normalize_metric(db_path, metric_name, raw_value, date)` which:

1. **Loads thresholds** from `metric_config` table (`load_thresholds()`, line 126–144)
2. **Applies volatility adjustment** for `mvrv_z`, `aviv_ratio`, `aviv_nupl` only (lines 155–176):
   - Computes 1-year rolling log-return volatility from `btc_ohlc`
   - `vol_ratio = vol_1y_causal / 0.80`, clamped to [0.4, 1.5]
   - Multiplies `t_minus_1` and `t_minus_2` by `vol_ratio`
   - This EXPANDS the negative-side thresholds during high-vol periods, making it harder to reach -2.0
3. **Piecewise linear interpolation** (`normalize()`, lines 18–110):
   - Auto-detects direction (normal vs inverted) from threshold ordering
   - Handles three cases: `is_bottom_only`, `is_top_only`, or full 4-threshold
   - Returns `NaN` for values outside the configured threshold range (one-sided metrics)
   - Maps to continuous [-2.0, +2.0] scale

### 2.2 Threshold Configuration (from `metric_config` table)

**Source:** `data/maftia_quant.db` → `metric_config` table

| metric_name | t_minus_2 | t_minus_1 | t_zero | t_plus_1 | t_plus_2 | Direction |
|------------|-----------|-----------|--------|----------|----------|-----------|
| ahr999 | 5.47 | 2.9 | NULL | 0.7 | 0.45 | Normal (low=expensive) |
| aviv_nupl | 0.5 | 0.3 | NULL | -0.3 | -0.6 | Normal |
| aviv_ratio | 2.0 | 1.0 | NULL | -1.0 | -2.0 | Inverted |
| aviv_ratio_z | 2.0 | 1.0 | NULL | -1.0 | -2.0 | Inverted |
| cvdd_ratio | NULL | NULL | NULL | 1.6 | 1.3 | Bottom-only |
| dvrsi | 73.0 | 65.0 | NULL | 50.0 | 42.0 | Normal |
| fear_greed_cmc | 80.0 | 60.0 | NULL | 40.0 | 20.0 | Normal |
| fear_greed_og | 70.0 | 60.0 | NULL | 50.0 | 30.0 | Normal |
| lth_sth_sopr_ratio | 6.9 | 3.2 | NULL | 0.99 | 0.73 | Normal |
| mvrv_z | 6.65 | 4.6 | NULL | 0.17 | 0.15 | Normal |
| pi_cycle_top | 0.95 | 0.7 | NULL | 0.45 | 0.35 | Normal |
| risk_metrics | 0.85 | 0.75 | NULL | 0.33 | 0.13 | Normal |
| sharpe_ratio_52w | 53.0 | 42.0 | NULL | -10.0 | -20.0 | Inverted |
| terminal_price_ratio | 0.17 | 0.25 | NULL | 0.75 | 1.0 | Normal (low=expensive) |
| two_year_ma | 4.2 | 3.0 | NULL | 1.0 | 0.7 | Normal |
| unrealized_sell_risk | 2.2 | 1.8 | NULL | NULL | NULL | Top-only |
| vpli | 80.0 | 70.0 | NULL | 50.0 | 45.0 | Normal |
| williams_r | NULL | NULL | NULL | -70.0 | -80.0 | Bottom-only |

**Thresholds are STATIC** — they do NOT adapt per cycle. They are fixed in the database.

---

## 3. Composite Calculation (Two-Stage Process)

### Stage 1: Raw Composite (simple average of individual normalized scores)

**File:** `run_report_pipeline.py:36–176` (`fetch_valuation_composite_data()`)

```sql
SELECT date, AVG(normalized_value) as comp, MAX(btc_price) as btc
FROM timeseries_metrics
WHERE normalized_value IS NOT NULL
  AND metric_name NOT IN ('aviv_nupl', 'williams_r', 'fear_greed_cmc')
GROUP BY date
HAVING COUNT(normalized_value) >= 10
```

- Equal weighting (simple `AVG`)
- Excludes 3 metrics (`aviv_nupl`, `williams_r`, `fear_greed_cmc`)
- Requires minimum 10 valid (non-NULL) normalized values per date
- Typical valid count: 11–13 metrics per day (2 metrics often return NULL: `cvdd_ratio` and `unrealized_sell_risk`)

### Stage 1.5: Asymmetric Modifiers (applied to raw composite)

Applied only when `raw_val < 0` (negative/overvalued side):

1. **Volatility Regime Multiplier** (CVSC-based):
   - `cvsc_factor = max(0, log10(cvsc_value) - 13.0) * 0.2`
   - `vol_factor = max(0, (0.05 / vol_730d) - 1.0) * 0.1`
   - `multiplier = 1.0 + cvsc_factor + vol_factor`

2. **Illiquidity Premium (IIP) Penalty**:
   - Computes `illiquidity_factor = LTH_supply / active_supply`
   - `iip_penalty = max(0, (illiquidity_factor / cum_mean - 1)^2)`
   - Applied as: `raw_val = raw_val * multiplier - iip_penalty * abs(raw_val)`

3. **Hard clamp** to [-2.0, +2.0]

### Stage 2: Causal Expanding-Window Percentile Rescaling

**File:** `run_report_pipeline.py:156–172`

After the asymmetric modifiers, the composite undergoes a **second normalization**:

```python
# Expanding window with min 180 days history
hist_vals = raw_comp_history[:-1]  # all previous values
p2_5 = np.percentile(hist_vals, 2.5)
p50 = np.percentile(hist_vals, 50.0)
p97_5 = np.percentile(hist_vals, 97.5)

# Piecewise linear interpolation to [-2, +2]
if raw_val <= p2_5: rescaled = -2.0
elif raw_val >= p97_5: rescaled = +2.0
elif raw_val < p50: rescaled = -2.0 + 2.0 * (raw_val - p2_5) / (p50 - p2_5)
else: rescaled = 0.0 + 2.0 * (raw_val - p50) / (p97_5 - p50)
```

This is **causal** (only uses historical data up to t-1) and uses an **expanding window** (not rolling), meaning the percentile anchors shift over time as more data accumulates.

### All-Time Raw Composite Distribution Stats

| Statistic | Value |
|-----------|-------|
| Count | 4,961 days |
| Min | -1.4597 |
| Max | +1.5394 |
| Mean | +0.3195 |
| Median (p50) | +0.3403 |
| p2.5 | -1.1718 |
| p97.5 | +1.4620 |

**Key observation:** The historical median of the raw composite is +0.34, which is significantly positive. This means any raw composite below +0.34 maps to a negative rescaled score.

---

## 4. The `-0.27` Mystery — Root Cause Analysis

### The Specific Case: Oct 6, 2025 (BTC at $124,658 ATH)

| Stage | Value | Explanation |
|-------|-------|-------------|
| Raw composite (avg of 11 metrics) | **+0.153** | Modestly positive |
| After asymmetric modifier | **+0.153** | No change (raw_val > 0, modifiers only apply to negative side) |
| Causal rescaling | **-0.272** | Raw 0.153 < historical p50 (0.34), maps to negative |

**Calculation trace for the rescaling:**

- p2.5 ≈ -1.17, p50 ≈ 0.34, p97.5 ≈ 1.46 (expanding window as of Oct 2025)
- raw_val = 0.153 < p50 = 0.34
- denom = p50 - p2.5 = 0.34 - (-1.17) = 1.51
- rescaled = -2.0 + 2.0 × (0.153 - (-1.17)) / 1.51 = -2.0 + 2.0 × 0.876 = **-0.248**

This closely matches the observed -0.272 (the expanding percentiles shift slightly day-to-day).

### Why Does the Raw Composite Stay Low Despite ATH Prices?

**1. Individual Metrics Disagree — Mixed Signals at ATH**

On Oct 20, 2025 (BTC at $110K, still elevated):

| Component | Raw Value | Normalized | Signal |
|-----------|-----------|------------|--------|
| ahr999 | 1.036 | +0.69 | Moderately undervalued |
| aviv_nupl | 0.268 | -0.89 | Overvalued (but excluded) |
| aviv_ratio | 0.510 | -0.51 | Overvalued |
| fear_greed_og | 45.7 | +1.21 | Undervalued (low sentiment!) |
| lth_sth_sopr_ratio | 1.675 | +0.38 | Neutral |
| mvrv_z | 1.780 | +0.27 | Neutral |
| pi_cycle_top | 0.564 | +0.08 | Neutral |
| risk_metrics | 0.451 | +0.42 | Neutral |
| sharpe_ratio_52w | 1.067 | +0.57 | Moderately undervalued |
| terminal_price_ratio | 0.432 | -0.27 | Slightly overvalued |
| two_year_ma | 1.418 | +0.58 | Moderately undervalued |
| vpli | 51.9 | +0.81 | Moderately undervalued |
| **cvdd_ratio** | 2.728 | **NULL** | Out of valid range (NaN) |
| **unrealized_sell_risk** | 1.036 | **NULL** | Out of valid range (NaN) |

**Key insight:** Despite $110K+ prices, many metrics show "undervalued" or "neutral" signals because:

- **Sentiment is fearful** (`fear_greed_og` at 45.7 → +1.21)
- **MVRV Z-Score** at 1.78 maps to only +0.27 because the vol-adjusted thresholds (t_minus_1=4.6×vol_ratio) are wide
- **AHR999** at 1.036 maps to +0.69 because the price is below the 2-year MA extrapolation
- Only `aviv_ratio` and `terminal_price_ratio` signal overvaluation

**2. Two Metrics Silently Return NULL**

- `cvdd_ratio` raw value of 3.0 exceeds `t_plus_1=1.6` in its bottom-only configuration → returns `NaN`
- `unrealized_sell_risk` raw value of 1.0 is below `t_minus_1=1.8` in its top-only configuration → returns `NaN`
- These metrics only produce valid scores within narrow historical windows:
  - `cvdd_ratio`: only valid when price/CVDD ∈ [1.3, 1.6] (recent post-crash periods, Jul 2026)
  - `unrealized_sell_risk`: only valid when ratio ∈ [1.8, 2.2] (Nov 2021 peak)

**3. Threshold Calibration Is Static, Not Per-Cycle**

The thresholds in `metric_config` are fixed values, NOT dynamically calibrated per market cycle. The `metric_thresholds.json` file exists but only contains an alternative `mvrv_z` config:

```json
{"mvrv_z": {"t_minus_2": 3, "t_minus_1": 1.5, "t_zero": 0, "t_plus_1": -1.5, "t_plus_2": -3}}
```

This JSON is NOT used by the normalization code — it reads from the `metric_config` SQLite table only.

**4. The Causal Rescaling Amplifies the Compression**

The expanding-window percentile rescaling means:

- Historical extremes (2011–2013 at +2.0, 2017–2018 at -2.0) anchor the percentile tails
- As the window grows, the p2.5 and p97.5 become more stable
- A raw composite of +0.15 (which would be "slightly above neutral" on a [-2, +2] scale) gets rescaled to **negative** because the historical median (+0.34) is higher
- This is a **feature, not a bug** — it means the composite correctly identifies that a raw score of +0.15 is below historical norms

**5. The Volatility Adjustment Further Dampens MVRV Z-Score**

For `mvrv_z`, the `t_minus_1` and `t_minus_2` thresholds are multiplied by a volatility ratio (0.4–1.5). During low-volatility periods, this makes it harder for MVRV Z-Score to reach -2.0 because the thresholds shrink.

---

## 5. Summary: Why the Composite Doesn't Reach Extreme Values

| Factor | Impact | Severity |
|--------|--------|----------|
| **Averaging 11+ metrics** | Natural regression to mean; individual extremes cancel out | HIGH |
| **Two metrics return NULL** | `cvdd_ratio` and `unrealized_sell_risk` are silent during most market conditions | MEDIUM |
| **Static thresholds** | Not calibrated per cycle; some thresholds from 2021 may be too tight/loose for 2025 | MEDIUM |
| **Causal expanding-window rescaling** | Historical median (+0.34) makes modest positive composites map to negative | HIGH |
| **Vol-adjusted MVRV thresholds** | Volatility ratio dampens the negative signal during low-vol ATH periods | LOW |
| **Asymmetric IIP penalty** | Only applies to negative side, further compressing the range | LOW |

### The Composite IS Working Correctly

The composite score of -0.27 on Oct 6, 2025 (BTC at $124K ATH) is **accurate** per its design:

1. The raw average of 11 metrics was +0.153 (modestly positive)
2. After causal rescaling against the full historical distribution, +0.153 falls below the historical median
3. The rescaled score of -0.27 correctly says "this raw composite is below the historical norm"
4. The bubble warning threshold (≥ +1.50) was never triggered because no individual metric hit extreme overvaluation

The system is designed as a **mean-reversion valuation framework**, not a price-tracking instrument. During an ATH, some metrics signal overvaluation while others (sentiment, 2-year MA, AHR999) still signal relative value, resulting in a moderate composite that's slightly below the long-term median.

---

## 6. File Paths & Line Numbers Summary

| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| Component discovery | `engines/valuation/quant/components/registry.py` | 1–26 | Dynamic import of all BaseComponent subclasses |
| BaseComponent | `engines/valuation/quant/components/base.py` | 1–140 | ABC with fetch/normalize/store/pipeline |
| Normalization core | `engines/valuation/quant/components/normalization.py` | 18–110 | Piecewise linear interpolation |
| Threshold loading | `engines/valuation/quant/components/normalization.py` | 126–144 | Reads from `metric_config` table |
| Volatility adjustment | `engines/valuation/quant/components/normalization.py` | 155–176 | Vol ratio for mvrv_z, aviv_ratio, aviv_nupl |
| Vol ratio computation | `engines/valuation/quant/components/normalization.py` | 83–109 | 1-year rolling vol from btc_ohlc |
| MVRV Z-Score | `engines/valuation/quant/components/mvrv_z.py` | 1–74 | Representative component implementation |
| CVDD Ratio | `engines/valuation/quant/components/cvdd_ratio.py` | 1–56 | Component with narrow valid range |
| Unrealized Sell Risk | `engines/valuation/quant/components/unrealized_sell_risk.py` | 1–52 | Component with narrow valid range |
| Orchestration | `engines/valuation/quant/run_all.py` | 1–88 | Runs all component pipelines sequentially |
| Composite calculation | `run_report_pipeline.py` | 36–176 | Raw avg + asymmetric modifier + causal rescaling |
| Audit composite | `engines/valuation/quant/audit/composite.py` | 1–86 | Alternate percentile-based rescaling |
| Audit runner | `engines/valuation/quant/audit/runner.py` | 1–97 | Orchestrates full audit pipeline |
| Threshold validation | `engines/valuation/quant/audit/threshold.py` | 1–120 | Validates threshold calibration |
| Audit script | `scripts/audit_valuation.py` | 1–52 | Data integrity & multicollinearity check |
| Metric config DB | `data/maftia_quant.db` → `metric_config` | N/A | 21 rows of static thresholds |
| Legacy thresholds | `data/metric_thresholds.json` | 1–9 | Only mvrv_z, NOT used by code |
