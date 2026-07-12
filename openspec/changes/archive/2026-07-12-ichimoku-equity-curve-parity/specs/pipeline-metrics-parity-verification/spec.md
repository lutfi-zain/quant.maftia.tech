# pipeline-metrics-parity-verification Specification (Delta)

## ADDED Requirements

### Requirement: Equity Curve Parity Verification (Cumulative Return Matching)

The verification harness (`verify_pipeline_api_parity.py`) SHALL cross-validate the cumulative strategy return and cumulative market return between the prior system's authority and the pipeline output.

The harness SHALL:

1. Run `backtest.run_backtest()` from the prior system against the `df_ich` DataFrame (same data the pipeline uses) to compute authoritative `Cum_Strat` and `Cum_Market`.
2. Query `unified_daily_analytics.ichi_cum_strat` and `ichi_cum_market` from the database.
3. Compare the two across all dates.

#### Scenario: Final cumulative return matches within tolerance

- **WHEN** the verification harness computes the prior system's final `Cum_Strat.iloc[-1] * 100` (total return %)
- **THEN** the database `ichi_cum_strat` on the same final date SHALL match within tolerance $|a - b| < 10^{-4}$ (relaxed for cumulative product precision)
- **AND** the total strategy return reported in the report table SHALL match

#### Scenario: Cumulative market return matches buy-and-hold

- **WHEN** the verification harness computes the prior system's `Cum_Market.iloc[-1] * 100`
- **THEN** the database `ichi_cum_market` on the same final date SHALL match within tolerance $|a - b| < 10^{-4}$

### Requirement: Sharpe Ratio Parity Verification

The verification harness SHALL compute the Sharpe ratio from the prior system's `Strat_Net_Ret` series and from the pipeline-derived daily returns (computed from `ichi_cum_strat` differences) and verify they match.

Annualized Sharpe = (Mean daily return / Std daily return) × sqrt(365.25)

#### Scenario: Sharpe ratio matches within 1%

- **WHEN** the verification harness computes Sharpe from the prior system's backtest
- **THEN** the pipeline-derived Sharpe SHALL match with relative difference $|a - b| / max(|a|, |b|) < 0.01$

### Requirement: Max Drawdown Parity Verification

The verification harness SHALL compute max drawdown from both the prior system's and the pipeline's equity curves and verify they match.

Drawdown = (Peak equity - Current equity) / Peak equity

#### Scenario: Max drawdown matches within 0.5 percentage points

- **WHEN** the verification harness computes max drawdown from both sources
- **THEN** the absolute difference SHALL be less than 0.5 percentage points: $|a - b| < 0.5$

### Requirement: Trade Count Parity Verification

The verification harness SHALL count the number of position transitions (0→1 and 1→0) in the reference position signal (`ichi_ref_pos`) and compare against the prior system's trade count from `run_backtest()`.

#### Scenario: Trade count matches

- **WHEN** the verification harness counts position transitions
- **THEN** the trade count SHALL match exactly between the prior system and the pipeline's reference position

### Requirement: Reference Position Integrity (Override Detection)

The verification harness SHALL verify that `ichi_ref_pos` (pure) and `ichimoku_position` (overridden) diverge on dates where macro overrides are active, and match on all other dates.

#### Scenario: Position divergence indicates correct override application

- **WHEN** LTTD regime is SIDEWAYS with probability > 0.6 on a given date
- **THEN** `ichi_ref_pos` SHALL retain the pure Ichimoku signal value (0 or 1) on that date
- **AND** `ichimoku_position` SHALL be 0.0 on that date (overridden)
