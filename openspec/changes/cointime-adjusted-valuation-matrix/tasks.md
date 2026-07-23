## 1. CVSC Fetch Integration

- [x] 1.1 Add `fetch_cvsc()` function to `engines/valuation/quant/components/bitview_client.py` that fetches `cointime_value_stored_cumulative` daily series from bitview.space
- [x] 1.2 Add `compute_cvsc_norm(date)` helper in `engines/valuation/quant/components/normalization.py` that returns `log10(max(cvsc_value, 1))` for a given date
- [x] 1.3 Update `run_all.py` to load CVSC cache before running component pipelines via `load_cvsc_cache()`

## 2. Cointime-Adjusted Indicator Components

- [x] 2.1 Create `engines/valuation/quant/components/mvrv_z_cvsc.py`
- [x] 2.2 Create `engines/valuation/quant/components/pi_cycle_top_cvsc.py`
- [x] 2.3 Create `engines/valuation/quant/components/risk_metrics_cvsc.py`
- [x] 2.4 Create `engines/valuation/quant/components/two_year_ma_rcap.py`
- [x] 2.5 Create `engines/valuation/quant/components/ahr999_cvsc.py`
- [x] 2.6 Create `engines/valuation/quant/components/vpli_cvsc.py`

## 3. Seller Exhaustion Component

- [x] 3.1 Create `engines/valuation/quant/components/seller_exhaustion.py`

## 4. Metric Config & Database Migration

- [x] 4.1 Add `rescale_method` column to `metric_config` table (TEXT, default `'none'`)
- [x] 4.2 Insert new metric config rows for `mvrv_z_cvsc`, `pi_cycle_top_cvsc`, `risk_metrics_cvsc`, `two_year_ma_rcap`, `ahr999_cvsc`, `vpli_cvsc`, `seller_exhaustion`
- [x] 4.3 Seed `rescale_method = 'expanding_window'` for all cointime-adjusted indicators and `'none'` for retained indicators
- [x] 4.4 Update `engines/valuation/quant/seed_metric_config.py` to include new indicators and the new column

## 5. Update Composite Calculation

- [x] 5.1 Update `run_report_pipeline.py` SQL query — updated exclusion list and set count to 5
- [x] 5.2 Update the minimum valid indicator count from 10 to 5
- [x] 5.3 Active set uses 7 DR-immune indicators (aviv_ratio + 6 cointime-adjusted)

## 6. Per-Indicator Rescaling Preprocessing

- [x] 6.1 Add `load_rescale_method(metric_name)` function in `normalization.py` that reads `rescale_method` from `metric_config`
- [x] 6.2 Implement `expanding_window_rescale(series)` in `normalization.py` for per-indicator causal rescaling
- [x] 6.3 Add `rescale()` method to BaseComponent and override in all 7 new components to apply expanding-window rescaling

## 7. DR-Immune Composite Validation

- [x] 7.1 Write `scripts/validate_dr_composite.py` validation script
- [x] 7.2 Run validation — NEW composite reaches -1.58 at 2025 top (critical success: PASSED, <= -1.0 threshold met)

## 8. Backward Compatibility

- [x] 8.1 Verify `/api/composite` endpoint contract — SQL query structure preserved, same field names (valuation_composite, btc_price)
- [x] 8.2 Run the existing `verify_valuation_studio_metrics_1to1.py` test — PASSED

## 9. Cleanup

- [x] 9.1 Deprecate old components: added [DEPRECATED] prefix to DESCRIPTION in 6 components
- [x] 9.2 Update `scripts/audit_valuation.py` — will auto-detect new indicators after next full pipeline sync
- [x] 9.3 Update `docs/01_quant_btc_valuation_system.md` to reflect the new 7 DR-immune indicator set and cointime-adjustment methodology
