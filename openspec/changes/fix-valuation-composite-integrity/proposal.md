## Why

The `ValuationComposite` is still compromised by three residual issues after threshold normalization fixes. First, multicollinearity among redundant indicator pairs (e.g., `fear_greed_cmc`/`fear_greed_og` at r=0.918, `dvrsi`/`risk_metrics` at r=0.902) artificially inflates the weight of shared signals, biasing the equally-weighted aggregation. Second, `williams_r` remains one-sided (`[0, +2.0]`) due to its threshold configuration mismatched with the Williams %R oscillator's native range (`-100` to `0`). Third, data availability for `dvrsi`, `fear_greed_cmc`, and `aviv_ratio` remains severely degraded (60-92% missing) due to upstream provider issues or weekly-to-daily join gaps, dragging down the composite's sample coverage.

## What Changes

- **Multicollinearity Compression**: Apply PCA-based dimensionality reduction to the 17 indicators before computing `ValuationComposite`, following the same proven approach used by the LTTD system for VIF pruning and variance retention.
- **Williams %R Threshold Correction**: Recalibrate `williams_r` thresholds to map its native `[-100, 0]` oscillator to the full `[-2.0, +2.0]` normalization range without truncation.
- **Data Completeness Protocol**: Implement fallback imputation strategies for metrics with >50% missing data: replace missing `dvrsi` with daily-equivalent smoothed values from raw daily OHLC, replace missing `fear_greed_cmc` with its high-correlation twin `fear_greed_og`, and add a stale-data alert for external providers (checkonchain) that fail repeatedly.

## Capabilities

### New Capabilities

- `valuation-pca-compression`: A PCA projection layer that pre-processes the 17 raw normalized component scores into orthogonal principal components, discarding components with variance ratio < 5%, before computing the composite mean.

### Modified Capabilities

- `valuation-be-calculation`: Requirements for data imputation and stale-provider fallback logic.

## Impact

- **Affected Code**: `quant-btc-valuation-system` Python codebase — new PCA module and updates to `run_report_pipeline.py` for composite generation.
- **Systems Impacted**: Valuation System (1 of the 4 unified systems).
- **Dependencies**: Re-running `python3 /home/ubuntu/projects/run_report_pipeline.py --rebuild` will generate a new `valuation_composite` time-series in `maftia_quant.db`.

## Non-goals

- Removing any of the 17 indicator components entirely (they remain as individual signals for frontend display).
- Altering the `unified_component_signals` schema.
- Changing LTTD, MTTD, or Ichimoku systems.
- Re-introducing `quant-technical-indicator-bank`.
