## 1. PCA Compression Layer

- [x] 1.1 Create `engines/valuation/quant/components/pca_compression.py` module that: (a) collects 17 normalized scores from `unified_component_signals`, (b) fits rolling 365-day PCA, (c) discards components with explained variance < 5%, (d) saves projection matrix to SQLite.
- [x] 1.2 Integrate PCA computation into `run_report_pipeline.py` before `valuation_composite` aggregation so the composite uses the mean of retained principal components scaled to `[-2.0, +2.0]`.

## 2. Williams %R Threshold Correction

- [x] 2.1 Update `seed_metric_config.py` to set `williams_r` thresholds to `t_plus_2=-100, t_plus_1=-80, t_minus_1=-20, t_minus_2=0`.
- [x] 2.2 Confirm normalization function auto-detection works correctly (t_plus_2=-100 < t_minus_2=0 = standard direction, no change needed).

## 3. Data Completeness Fallback

- [x] 3.1 Implement DRSI fallback: in `engines/valuation/quant/components/dvrsi.py`, on NaN values, compute daily RSI from daily `master_ohlcv.close` with window=14 and pass through existing `dvrsi` thresholds.
- [x] 3.2 Implement Fear & Greed CMC fallback: in `run_report_pipeline.py`, for each date where `fear_greed_cmc` normalized_score is NaN but `fear_greed_og` has a value, copy `fear_greed_og` normalized_score to `fear_greed_cmc`.

## 4. Verification & Deployment

- [x] 4.1 Run `python3 /home/ubuntu/projects/run_report_pipeline.py --rebuild` with full rebuild to re-compute all historical composites.
- [x] 4.2 Run audit script `python3 scripts/audit_valuation.py` to verify: no flatline metrics, all 17 indicators have full `[-2.0, 2.0]` range, PCA-reduced composite has no multicollinearity artifacts.
- [x] 4.3 Commit with conventional commit message and push to `main`.
