## Context

The Valuation Composite score is derived from the arithmetic mean of 17 on-chain metrics, each mapped to a `-2.0` (Overvalued) to `+2.0` (Undervalued) piecewise linear scale. In recent macro tops (Nov 2021, Mar 2024, Jan 2025), standard oscillators like MVRV failed to reach the `+4.0` extremes necessary to trigger the `-2.0` valuation limit due to massive absolute growth in `cointime_value_stored_cumulative` (institutional capital locks) and structurally lower volatility. To resolve this without contaminating the fundamental indicators, we are introducing a regime-aware mathematical multiplier at the point of composite aggregation.

## Goals / Non-Goals

**Goals:**

- Apply the formula `RawComposite * (0.05 / Volatility_730d) * (CVSC ^ 0.04)` during the final calculation of the Valuation Composite.
- Extract `cointime_value_stored_cumulative` (CVSC) directly via the `bitview_client.py` utility in the Valuation system.
- Extract or calculate `Volatility_730d` (the 730-day rolling standard deviation of 30-day percentage returns of market cap or price, depending on which accurately reflects macro volatility).
- Maintain `ValuationStudio.tsx` limits and HSL mappings to natively render the adjusted composite without architectural breakage (ensuring Y-axis locks to `85px` and crosshair sync remain intact).

**Non-Goals:**

- Modifying the underlying logic or database schema for the 17 individual component indicators.
- Updating the LTTD or MTTD core logic; they will simply consume the adjusted `valuation_composite` automatically via the existing Unified Analytics database and API Gateway (`:8910`).

## Decisions

**1. Point of Aggregation:**
*Decision:* Apply the multiplier in the `run_all.py` pipeline (or wherever the `composite_value` is calculated and written to SQLite) rather than on-the-fly in the Bun API.
*Rationale:* This persists the adjusted value in the SQLite WAL database permanently and allows `run_report_pipeline.py` to transparently sync the correct `ValuationComposite` down to `unified_daily_analytics` without needing to port the complex statistical logic into TypeScript.

**2. Data Extraction (`bitview_client.py`):**
*Decision:* We will fetch `cointime_value_stored_cumulative` using the existing Bitview API client.
*Rationale:* The API natively supports this time series. We must ensure the client properly caches or handles potential network delays during the pipeline run.

**3. Volatility Calculation:**
*Decision:* Calculate 730-day rolling volatility in Python using a robust `pandas` rolling window over daily `price` or `market_cap` percent changes.
*Rationale:* Pandas `rolling(730, min_periods=30).std()` is highly optimized and prevents Zero Lookahead Bias naturally. We will use a 30-day smoothed volatility of daily returns, anchored to the 730-day macro window.

## Risks / Trade-offs

- **[Risk] Early Data Instability:** Before 2013 (first 730 days of Bitcoin), the 730-day rolling volatility window might be incomplete or excessively noisy.
  *Mitigation:* Use `min_periods=30` and provide a sane fallback cap on the multiplier to prevent the composite from exceeding structural boundaries (`[-2.0, +2.0]`) during the genesis years.
- **[Risk] Scaling Drift:** If CVSC grows exponentially faster than historical models predict by 2030, the `^0.04` exponent might push the composite past `-2.0` too easily.
  *Mitigation:* Implement a hard clamp (`clip(-2.0, 2.0)`) on the final `final_composite` value in Python before database insertion to guarantee contract safety for the frontend UI components and the LTTD CircuitBreaker logic.
