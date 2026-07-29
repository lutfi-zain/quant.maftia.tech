## 1. Stationarize Non-Stationary Metrics (Option 2)

- [ ] 1.1 Refactor `TwoYearMaRcapComponent` in `engines/valuation/quant/components/two_year_ma_rcap.py` to compute `raw_value = (close - two_year_ma) / two_year_ma` as a dimensionless percentage deviation.
- [ ] 1.2 Refactor `TerminalPriceRatioComponent` in `engines/valuation/quant/components/terminal_price_ratio.py` to compute `raw_value = (close - terminal_price) / terminal_price`.
- [ ] 1.3 Recalibrate threshold configurations for `two_year_ma_rcap` and `terminal_price_ratio` using empirical percentiles and update `seed_metric_config.py`.

## 2. Decouple Macro Valuation & Tactical Sentiment Layers (Option 3)

- [ ] 2.1 Add `category_layer` column migration (`'macro_valuation'` vs `'tactical_sentiment'`) to `metric_config` in `seed_metric_config.py`.
- [ ] 2.2 Tag indicators in `seed_metric_config.py`: set `category_layer = 'tactical_sentiment'` for `fear_greed_og`, `fear_greed_cmc`, `williams_r`, `dvrsi`, `sharpe_ratio_52w`, `sharpe_52w`.
- [ ] 2.3 Update `audit/composite.py` and `run_report_pipeline.py` composite aggregation to filter for `category_layer == 'macro_valuation'` indicators when computing `ValuationComposite`.

## 3. Historical Rebuild & Pipeline Sync

- [ ] 3.1 Execute `--rebuild` for `two_year_ma_rcap` and `terminal_price_ratio`.
- [ ] 3.2 Run `seed_metric_config.py` to apply new threshold seeds and category layers to `metrics.db`.
- [ ] 3.3 Run `python3 run_report_pipeline.py` end-to-end to sync `maftia_quant.db` tables (`unified_daily_analytics` and `unified_component_signals`).

## 4. Verification & Validation

- [ ] 4.1 Verify November 2022 bottom composite score reaches `+2.000` (or `> +1.95`).
- [ ] 4.2 Verify March 10, 2024 mid-cycle rally composite score stays in fair-value/mild bull territory (`-0.3` to `-0.5`) instead of maxing out at `-2.000`.
- [ ] 4.3 Verify November 2021 cycle peak composite score remains at `-2.000`.
- [ ] 4.4 Commit all changes with `quant: stationarize valuation metrics and decouple tactical sentiment from macro composite`.
