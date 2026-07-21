## 1. Valuation Composite Modification

- [x] 1.1 In `run_all.py` (or the specific aggregation script where `ValuationComposite` is calculated), import and fetch `cointime_value_stored_cumulative` using `bitview_client.fetch_series("cointime_value_stored_cumulative")`.
- [x] 1.2 In the same script, fetch a price or market cap series (e.g. `price`) to compute daily percentage returns.
- [x] 1.3 Calculate the 730-day rolling standard deviation of 30-day returns for historical and current volatility context (`Volatility_730d`), ensuring `min_periods=30` to prevent early-data failures.
- [x] 1.4 Apply the aggregation multiplier formula `RawComposite * (0.05 / Volatility_730d) * (CVSC ^ 0.04)` to calculate the `final_composite` score.
- [x] 1.5 Implement a hard clamp (`clip(-2.0, 2.0)`) on the final score prior to SQLite database insertion.

## 2. API Gateway & Frontend Sync

- [x] 2.1 Verify that the Hono API Gateway (`/api/composite`) correctly proxies the newly clamped `-2.0` to `+2.0` valuation score without raising numerical overflow/precision errors.
- [x] 2.2 In `ValuationStudio.tsx`, ensure the bottom composite subplot seamlessly accepts the dynamically scaled values and that threshold limits (`< -1.5`) naturally trigger the expected HSL color mapping for a macro top.
- [x] 2.3 Re-verify that the right Y-axis width lock remains precisely at `85px` on all updated frontend visual layers via the `syncYAxisWidth` utility.

## 3. Pipeline Validation & Acceptance

- [x] 3.1 Execute `python3 engines/valuation/quant/run_all.py` locally to verify the new multiplier calculation processes successfully against historical data.
- [x] 3.2 Execute the master orchestration pipeline via `python3 run_report_pipeline.py` to confirm the adjusted `valuation_composite` syncs accurately down into `unified_daily_analytics`.
- [x] 3.3 Commit all changes locally adhering strictly to Conventional Commits format (e.g., `quant: implement volatility regime multiplier for valuation composite`).
