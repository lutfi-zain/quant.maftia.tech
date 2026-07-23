## Context

The Valuation Composite currently averages 14 normalized indicators, then applies expanding-window percentile rescaling. Research across 6 BTC cycles (2013-2025) shows that 10 of 14 indicators suffer from Diminishing Returns — their signal amplitude decays each cycle. At the October 2025 top ($124,658), most indicators remained neutral or showed undervalued signals, producing a composite of only -0.27 instead of the expected -2.0.

The root cause is static thresholds: MVRV Z-Score's `t_minus_1=4.6` was calibrated in 2013 when BTC was a fraction of its current market cap. By 2025, the same threshold is unreachable because the market structure has matured and volatility has compressed.

The solution is **cointime-adjustment**: dividing each indicator's raw value by Cointime Value Stored Cumulative (CVSC) or a rolling cost-basis. This makes the denominator grow with the network, producing naturally stationary oscillators. AVIV Ratio (which uses cointime-adjustment) proves this works — it maintained consistent 0.53-0.68 readings across all cycles.

## Goals / Non-Goals

**Goals:**

- Replace static-threshold indicators with cointime-adjusted versions that are DR-immune
- Ensure the composite reaches at least -1.5 at a typical cycle top and +1.5 at a cycle bottom in ALL market conditions
- Maintain backward compatibility of the composite API endpoint (frontend unchanged)
- Reduce the active indicator count from 14 to 9 (fewer but higher quality signals)

**Non-Goals:**

- Removing the expanding-window percentile rescaling (it works correctly)
- Modifying LTTD, MTTD, or Ichimoku systems
- Changing the Valuation Studio frontend
- Adding new external dependencies beyond what's already used (bitview.space CVSC)

## Decisions

### Decision 1: Cointime Adjustment Formula

For each candidate indicator `I` with raw value `V_I`, compute the cointime-adjusted score as:

```
I_cointime = normalize(V_I / CVSC_norm)
```

Where `CVSC_norm = log10(max(CVSC, 1))` (log-transformed CVSC to handle exponential growth). The ratio `V_I / CVSC_norm` is then normalized to [-2, +2] via the existing piecewise linear interpolation with updated thresholds.

### Decision 2: New Indicator Set (9 Active)

| Indicator | Source | Replaces |
|-----------|--------|----------|
| AVIV Ratio (existing) | bitview.space | — |
| MVRV-Z / CVSC | bitview MVRV + CVSC | MVRV Z-Score |
| Pi Cycle / CVSC | bitview Pi Cycle + CVSC | Pi Cycle Top |
| Risk Metrics / CVSC | system Risk Metrics + CVSC | Risk Metrics |
| 2Yr MA / Rolling Realized Cap | system Two-Year MA + realized cap | Two-Year MA |
| AHR999 / CVSC | system AHR999 + CVSC | AHR999 |
| VPLI / CVSC | system VPLI + CVSC | VPLI |
| Terminal Price Ratio (existing) | system | Terminal Price Ratio |
| Seller Exhaustion (existing) | bitview.space | — |

Dropped: `lth_sth_sopr_ratio`, `sharpe_ratio_52w`, `fear_greed_og`, `dvrsi`, `cvdd_ratio`, `unrealized_sell_risk`

### Decision 3: Transformation Flow

```
Raw Values → Cointime Division → Piecewise Linear Norm → Per-Indicator AVG → Expanding-Window Rescale → Composite
```

The rescaling stays AFTER the average (same as now), not before.

### Decision 4: Threshold Updates

Cointime-adjusted ratios require new threshold configs. These are estimated empirically from each ratio's distribution across 2013-2025:

| Indicator | t_minus_2 | t_minus_1 | t_plus_1 | t_plus_2 |
|-----------|-----------|-----------|----------|----------|
| AVIV Ratio (unchanged) | 2.0 | 1.0 | -1.0 | -2.0 |
| MVRV-Z / CVSC | 0.15 | 0.08 | -0.03 | -0.06 |
| Pi Cycle / CVSC | 0.0025 | 0.0015 | -0.0008 | -0.0015 |
| Risk Metrics / CVSC | 6.5e-16 | 3.0e-16 | -1.5e-16 | -3.0e-16 |
| 2Yr MA / Realized Cap | 3.5 | 2.5 | 0.8 | 0.5 |
| AHR999 / CVSC | 1.2e-15 | 6.0e-16 | -3.0e-16 | -5.0e-16 |
| VPLI / CVSC | 2.0e-14 | 1.0e-14 | -5.0e-15 | -1.0e-14 |

## Decision 5: Pipeline Integration

The CVSC fetch runs once per pipeline execution in `run_report_pipeline.py` and is cached for all indicator computations. Each indicator component reads the cached CVSC value from an in-memory dict.

## Risks / Trade-offs

- **CVSC fetch failure**: If bitview.space is down, CVSC cointime-adjustment falls back to 1.0 (raw value used), gracefully degrading to existing behavior
- **Numerical precision**: Some ratios involve very small numbers (Risk Metrics / CVSC ~1e-16). Use `Decimal` with sufficient precision or log-space computation
- **Calibration window**: New thresholds are estimated from 2013-2025 data. They may need adjustment after the next cycle if market structure changes again
- **Code complexity**: Adding CVSC fetches and division steps adds ~50 lines per indicator component
