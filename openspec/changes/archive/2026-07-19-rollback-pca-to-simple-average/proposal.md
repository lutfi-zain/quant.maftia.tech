## Why

The PCA compression layer introduced in `fix-valuation-composite-integrity` causes excessive signal noise (60x/year turnover vs 10x/year for simple average) and underperforms simple average by 8.1% absolute return over 5 years in SDCA backtesting. The rolling window PCA creates artificial day-to-day discontinuities because the projection basis shifts daily. Additionally, the frontend Valuation Studio renders raw component indicators that need cleanup — `williams_r` and redundant `fear_greed_cmc` add UI clutter without signal value.

## What Changes

- **Rollback PCA to Simple Average**: Remove the PCA compression layer from `run_report_pipeline.py`. Revert `valuation_composite` computation to simple equal-weighted average of 14 curated indicators (excluding `aviv_nupl`, `williams_r`, `fear_greed_cmc`).
- **Remove PCA Module**: Delete `engines/valuation/quant/components/pca_compression.py`.
- **Frontend Component Cards Cleanup**: Remove the indicator cards for `williams_r` and `fear_greed_cmc` from the Valuation Studio component grid, and ensure the remaining 14 indicator cards use consistent color coding by signal direction.
- **Add SDCA Signal Timeline to Frontend**: Add a small visual timeline strip showing `sdca_phase` (deep_discount/value/fair/expansion/euphoria) as a colored bar chart below the main chart area so users can see regime transitions at a glance.

## Capabilities

### Modified Capabilities

- `valuation-be-calculation`: Require simple equal-weighted average of 14 indicators (drop PCA).
- `studio-trading-terminals`: Add SDCA phase timeline visualization; remove redundant indicator cards.

## Impact

- **Affected Code**: `run_report_pipeline.py`, `engines/valuation/quant/components/pca_compression.py` (delete), `web/src/components/studios/ValuationStudio.tsx`.
- **Systems Impacted**: Valuation System; Frontend Valuation Studio.
- **Dependencies**: Full pipeline rebuild required after rollback.

## Non-goals

- Modifying LTTD, MTTD, or Ichimoku systems.
- Changing the API Gateway routes or response schema.
- Re-introducing `quant-technical-indicator-bank`.
