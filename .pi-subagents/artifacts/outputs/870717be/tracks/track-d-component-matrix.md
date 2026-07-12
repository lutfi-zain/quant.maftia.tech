# Track D: Component Matrix & Metric Grid — Parity Audit Report

## Source Files Compared

| Aspect | Unified System | Prior System |
|---|---|---|
| Component | `ValuationStudio.tsx` (lines 362-535) | `MetricGrid.tsx` + `MetricCard.tsx` |
| Types | `ComponentSignal` in `web/src/api/types.ts` | `MetricSummary` in `types/metrics.ts` |
| Data Source | `quantClient.getComponents("quant-btc-valuation-system")` | `fetchMetrics()` → `/api/metrics` |
| Sparklines | `Sparkline.tsx` (SVG polyline) | Recharts `<AreaChart>` in `MetricCard.tsx` |
| Navigation State | `selectedMetric: string \| null` (in ValuationStudio) | `activeMetric: string \| null` (in DashboardLayout) |

---

## Finding D.1 — CRITICAL: Score Double-Scaling Bug

**Description**: The unified system applies `normalized_score * 2` before displaying, but the database already stores values in [-2.0, +2.0] range. This causes displayed scores to be in [-4.0, +4.0] instead of [-2.0, +2.0].

**Evidence**:

- Database query confirms `unified_component_signals.normalized_score` range is `min=-2.0, max=2.0` (avg=0.25)
- Unified code at line 401: `const score = latestSignal ? toNum(latestSignal.normalized_score) * 2 : 0;`
- Sparkline data at line 396: `value: toNum(s.normalized_score) * 2,`
- Prior system displayed `MetricSummary.normalized_value` directly without multiplication

**Example**: A component with DB score `2.0` would display as `+4.000` in unified but `+2.00` in prior.

**Severity**: CRITICAL — data fidelity issue affecting ALL 17 indicators.

**Impact**: Score column, signal direction thresholds, sparkline Y-axis scaling, and color coding thresholds all incorrect due to double scaling.

---

## Finding D.2 — MAJOR: Terminology Inversion (Unified is Correct)

**Description**: The unified system uses inverted terminology compared to prior for the signal direction display. However, analysis confirms the unified terminology is CORRECT according to the documentation.

**Comparison**:

| Score Range | Prior Interpretation | Unified Direction | Unified Display |
|---|---|---|---|
| High (≥+1.0 in prior, >+0.5 in unified) | "UNDERVALUED (BUY)" | 1 | "OVERVALUED (+1)" |
| Low (≤-1.0 in prior, <-0.5 in unified) | "OVERVALUED (SELL)" | -1 | "DISCOUNT (-1)" |
| Neutral | "NEUTRAL" | 0 | "NEUTRAL (0)" |

**Analysis**:

- Prior composite chart labeled `+2.0` as "Undervalued" and `-2.0` as "Bubble" — inverted from the doc
- Prior `MetricCard.getInterpretationText` showed "UNDERVALUED (BUY)" for `score >= 1.0` — same inversion
- Documentation states: `score >= +1.50` = bubble risk (overvalued), `score <= -1.00` = deep discount (undervalued)
- Unified correctly labels: `+1.50` = "Bubble" (red), `-1.00` = "Discount" (green)
- Pipeline computes `signal_direction = 1` when `normalized_score > 0.5` and `-1` when `<-0.5`

**Verdict**: The unified system FIXED a bug in the prior system's terminology. Parity intentionally broken — this is a improvement, not a regression. Documented for awareness.

---

## Finding D.3 — PASS: All 17 Indicators Present with Matching Categories

**Verification**: All 17 indicators exist in unified `INDICATOR_METADATA` and match the prior system's component files 1:1.

| Indicator | Unified Category | Prior Category | Match |
|---|---|---|---|
| `aviv_ratio` | Fundamental | fundamental | ✓ |
| `aviv_nupl` | Fundamental | fundamental | ✓ |
| `cvdd_ratio` | Fundamental | fundamental | ✓ |
| `mvrv_z` | Fundamental | fundamental | ✓ |
| `lth_sth_sopr_ratio` | Fundamental | fundamental | ✓ |
| `terminal_price_ratio` | Fundamental | fundamental | ✓ |
| `unrealized_sell_risk` | Fundamental | fundamental | ✓ |
| `sharpe_ratio_52w` | Technical | technical | ✓ |
| `pi_cycle_top` | Technical | technical | ✓ |
| `vpli` | Technical | technical | ✓ |
| `risk_metrics` | Technical | technical | ✓ |
| `dvrsi` | Technical | technical | ✓ |
| `williams_r` | Technical | technical | ✓ |
| `two_year_ma` | Technical | technical | ✓ |
| `ahr999` | Technical | technical | ✓ |
| `fear_greed_og` | Sentiment | sentiment | ✓ |
| `fear_greed_cmc` | Sentiment | sentiment | ✓ |

**Severity**: PASS — no gap.

---

## Finding D.4 — MINOR: Description Text Changes

**Description**: Unified uses more detailed, explanatory descriptions. Prior used terse descriptions from component class attributes.

**Example differences**:

- `aviv_ratio`: prior="AVIV Ratio-Z", unified="Active Value to Investor Value ratio"
- `mvrv_z`: prior="MVRV Z-Score", unified="Market Value to Realized Value standardized Z-score"
- `risk_metrics`: prior="Bitcoin Risk Metric (SMA 374 + time decay)", unified="Composite technical market cycle risk score"

**Severity**: MINOR — intentional design difference, not a regression.

---

## Finding D.5 — MINOR: Signal Direction Threshold Difference

**Description**: Unified signal_direction uses thresholds `>0.5` and `<-0.5`. Prior system used `>=1.0` and `<=-1.0`. Both thresholds are within the [-2.0, +2.0] range but differ numerically.

**Pipeline code** (line 449):

```python
s_dir = 1 if vnorm_val > 0.5 else (-1 if vnorm_val < -0.5 else 0)
```

**Prior MetricCard**:

```typescript
if (score >= 1.0) return 'UNDERVALUED (BUY)';
if (score <= -1.0) return 'OVERVALUED (SELL)';
```

**Note**: Because of Finding D.2 (terminology inversion), the direction assignments are effectively:

- Unified: score > 0.5 → direction=1 ("OVERVALUED")
- Unified: score < -0.5 → direction=-1 ("DISCOUNT")
- Prior: score >= 1.0 → "UNDERVALUED (BUY)"
- Prior: score <= -1.0 → "OVERVALUED (SELL)"

The unified thresholds (0.5) are more sensitive than prior (1.0). More indicators will show as non-neutral.

**Severity**: MINOR — different design choice. Documented for awareness.

---

## Finding D.6 — MINOR: Layout Architecture Difference

**Description**: Unified uses a table layout with filter buttons (All/Fundamental/Technical/Sentiment). Prior used section-based grid layout with all categories visible simultaneously.

**Comparison**:

- **Unified**: Single table with category filter tabs at top, click to filter visible rows
- **Prior**: Three separate sections with header banners and component counts, all visible at once

**Severity**: MINOR — different UX approach, not a regression. Both show same data.

---

## Finding D.7 — PASS: Mobile Layout Present

**Unified**: Mobile view uses compact two-line list layout via `isMobile` check:

- Top line: name + score
- Bottom line: category badge + sparkline + signal direction badge
- Click triggers metric detail

**Prior**: No explicit mobile layout — used the same card grid across viewports.

**Severity**: PASS — unified improves over prior with responsive design.

---

## Finding D.8 — PASS: Metric Detail Navigation

**Unified**: Clicking a table row sets `selectedMetric` and replaces composite view with `MetricDetailChart`. Back button clears selection. Works on both desktop rows and mobile list items.

**Prior**: Clicking a MetricCard calls `onSelectMetric(name)`, which opens `MetricDetail` below the `CompositeChart` (not replacing it).

**Severity**: PASS — navigation flow works correctly, layout difference is intentional.

---

## Finding D.9 — MAJOR: Sparkline Data Source and Color Coding

**Description**: The unified sparkline data source and color coding differ from the prior system.

**Data Source**:

- **Unified**: `components.filter(c => c.component_name === key)` → sorts by date → `slice(-90)` → maps `normalized_score * 2`
- **Prior**: Fetched per-metric timeseries via `fetchMetricData(m.name)` → `slice(-90)` → maps `normalized_value`

**Color Coding**:

- **Unified**: Colored by `signal_direction` (green for -1 discount, red for +1 overvalued, gray for 0 neutral)
- **Prior**: Colored by `getValuationColor(metric.normalized_value)` — HSL gradient from green (undervalued) to red (overvalued)

**Impact on Finding D.1**: The sparkline data also uses `normalized_score * 2`, inheriting the double-scaling bug.

**Severity**: MAJOR — double-scaling affects sparklines too. Color coding strategy differs fundamentally (discrete by direction vs gradient by value).

---

## Summary of Findings

| ID | Description | Severity | Status |
|---|---|---|---|
| D.1 | Score double-scaling (`normalized_score * 2`) | **CRITICAL** | Needs fix |
| D.2 | Terminology vs prior inverted (unified is correct) | MAJOR | Intentional fix |
| D.3 | All 17 indicators present with matching categories | PASS | OK |
| D.4 | Description text changes | MINOR | Intentional |
| D.5 | Signal direction threshold change (0.5 vs 1.0) | MINOR | Diff design |
| D.6 | Layout: table vs sections | MINOR | Diff design |
| D.7 | Mobile layout | PASS | Improvement |
| D.8 | Metric navigation | PASS | Different but works |
| D.9 | Sparkline data source & color coding differs | MAJOR | Needs review |

## Critical Fix Required

**Fix D.1**: Remove the `* 2` multiplication in `ValuationStudio.tsx` at lines 396 and 401:

```typescript
// Line 396 — change from:
value: toNum(s.normalized_score) * 2,
// to:
value: toNum(s.normalized_score),

// Line 401 — change from:
const score = latestSignal ? toNum(latestSignal.normalized_score) * 2 : 0;
// to:
const score = latestSignal ? toNum(latestSignal.normalized_score) : 0;
```

This ensures scores display in the correct [-2.0, +2.0] range matching the database values and prior system behavior.
