## Why

The Master Valuation Oscillator historically failed to register extreme macro tops (`<-1.5` Circuit Breaker) during the 2021, 2024, and 2025 Bitcoin market peaks, known as the "blunted cycle" phenomenon. As the network matures, institutional adoption and the continuous ballooning of `cointime_value_stored` significantly suppress volatility and dampen traditional on-chain indicators. A composite-level volatility regime multiplier is needed to dynamically normalize the final score based on macro volatility and structural maturation, effectively restoring the validity of the valuation extremes for modern cycles without compromising the purity of the individual underlying indicators.

## What Changes

- Apply an inverse volatility smoothing multiplier (`0.05 / 730-day Rolling Volatility`) compounded by structural maturation (`CVSC ^ 0.04`) strictly at the **composite level**.
- Maintain the mathematical purity of the 17 individual underlying component indicators in the `quant-btc-valuation-system`—they will calculate and log exactly as before.
- The multiplier will be applied during the final aggregation calculation (`raw_composite`) before it is emitted as the `final_composite` value to the backend API (`/api/composite`) and stored in the unified daily analytics pipeline.
- Visual thresholds across the master Valuation Studio frontend (`hsl` mappings and threshold warning flags) might need subtle recalibrations corresponding strictly to the newly scaled output.

## Capabilities

### New Capabilities

- `volatility-regime-multiplier`: A composite score modifier for the `ValuationComposite` engine that dynamically scales the 17-indicator raw arithmetic mean against 730-day rolling market volatility and cumulative Cointime Value Stored.

### Modified Capabilities

- `valuation-composite`: Modified to accept and apply the `volatility-regime-multiplier` dynamically at the aggregation step, ensuring the `-2.0` to `+2.0` normalized boundary effectively reaches negative extremes during low-volatility mature market tops.

## Impact

- **Affected Systems**: `quant-btc-valuation-system` (Python ingestion orchestration and Hono API outputs) and `UnifiedDailyAnalytics` table orchestration.
- **Affected Pipeline**: The `run_all.py` pipeline of the Valuation System or `run_report_pipeline.py` where the final `composite_value` is calculated.
- **Data Guardrails**: Strictly utilizes `t-1` causal rolling windows (`rolling(window=730)`) ensuring Zero Lookahead Bias.

## Non-goals

- We will **not** modify or recalibrate the raw calculations of the 17 independent on-chain components (MVRV, Puell Multiple, Mayer Multiple, etc.). Their original mathematical schemas remain untouched.
- We will **not** impact the LTTD, MTTD, or Ichimoku quantitative systems, as their inputs derive strictly from price/volume and their own subsystem logics, not the Valuation Composite score.
- We will **not** reference or interact with the deprecated `quant-technical-indicator-bank`.
