## ADDED Requirements

### Requirement: Equity curve decimal baseline verification
The `IchimokuTerminal` SHALL verify that `ichi_cum_strat` and `ichi_cum_market` columns in `UnifiedDailyAnalytics` store decimal-baseline cumulative returns (i.e., values from `(1 + r).cumprod() - 1`), confirming the maximum recent value is within a plausible range (`< 100.0`) and not a multiplier form.

#### Scenario: Decimal baseline confirmed — chart renders correctly
- **WHEN** `ichi_cum_strat` values are queried from `maftia_quant.db` and found to be in decimal form (e.g. `0.693` for `+69.3%` cumulative return)
- **THEN** the `IchimokuTerminal` equity chart MUST apply `× 100` conversion (`p.ichimoku_cum_strat * 100`) and display `69.30%` on the Y-axis with a `%` suffix formatter

#### Scenario: Chart Y-axis format consistency
- **WHEN** the equity pane renders reference series data
- **THEN** both `refStratSeries` and `refMarketSeries` MUST use identical `priceFormatter` outputting values with exactly 2 decimal places and a `%` suffix (e.g. `+69.30%`)

#### Scenario: Null values are filtered
- **WHEN** `ichi_cum_strat` or `ichi_cum_market` returns `null` for a date (e.g. during early warmup period)
- **THEN** those null data points SHALL be filtered before passing to `refStratSeries.setData()` and `refMarketSeries.setData()` so Lightweight Charts does not receive `null` values

---

### Requirement: IMO banner metric label accuracy
The `IchimokuTerminal` header banner MUST accurately label the displayed `IchimokuDenoisedOscillator` value using the canonical ubiquitous language term rather than an intermediate mathematical step description.

#### Scenario: Banner label reflects final oscillator output
- **WHEN** the `IchimokuTerminal` banner renders the live `IchimokuDenoisedOscillator` value
- **THEN** the metric label MUST read `IMO DENOISED OSCILLATOR` (not `STATIONARY BOUNDED TANH`) to correctly identify it as the post-SuperSmoother composite output

#### Scenario: Sub-formula annotation is accurate
- **WHEN** a sub-label or tooltip is shown alongside the IMO oscillator value
- **THEN** it MUST describe the full transformation chain: `tanh(S_TK+S_Cloud+S_Future+S_Chikou)/4 → SuperSmoother[l=7] → [-1,+1]`

#### Scenario: Value sign and color remain consistent
- **WHEN** `latestImo > 0`
- **THEN** the value SHALL be displayed with a `+` prefix and rendered in `var(--accent)` (green)
- **WHEN** `latestImo <= 0`
- **THEN** the value SHALL be rendered in `var(--signal-bear)` (red)

---

### Requirement: Dual-path equity source transparency
The `IchimokuTerminal` SHALL clearly differentiate between the pre-computed Python reference equity curves (`ichi_cum_strat` / `ichi_cum_market`) and the `useStudioBacktest` recomputed equity used for display metrics, preventing user confusion from silently divergent values.

#### Scenario: Chart header badge identifies data source
- **WHEN** the equity growth pane header is rendered
- **THEN** it SHALL display a data-source badge indicating `PY ENGINE` for the reference series (green/grey lines sourced from `ichi_cum_strat`) and `COMPUTED` for any interactive what-if overlay

#### Scenario: Reference mode metrics badge
- **WHEN** `useStudioBacktest` runs in reference mode (`referenceMode = true`) and `usedReference = true`
- **THEN** the metrics display SHALL show a `source: "reference"` badge confirming it uses `ichimoku_strat_net_ret` from the Python backend

#### Scenario: Verification parity passes
- **WHEN** `python3 verify_ichimoku_studio_metrics_1to1.py` is run after all fixes
- **THEN** all comparison assertions MUST pass with `100/100 (100.0%)` — no metric divergence between TypeScript simulation and Python canonical engine

---

### Requirement: Pipeline `Cum_Strat` storage format consistency
The `run_report_pipeline.py` SHALL store `Cum_Strat` as a decimal-baseline value (i.e. `Cum_Strat = (1 + r).cumprod() - 1`) in the `ichi_cum_strat` column of `UnifiedDailyAnalytics`, never as a multiplier (`(1 + r).cumprod()`).

#### Scenario: Decimal storage confirmed in pipeline
- **WHEN** `backtest.run_backtest()` returns a DataFrame with `Cum_Strat` column
- **THEN** the pipeline at `run_report_pipeline.py:L408` SHALL store `float(r["Cum_Strat"])` directly (which is already `cumprod() - 1` from `backtest.py:L27`) without additional `- 1` or `+ 1` transformation

#### Scenario: Values bounded within plausible range
- **WHEN** querying `SELECT MAX(ichi_cum_strat) FROM unified_daily_analytics`
- **THEN** the maximum value SHALL be `< 100.0` (a value of e.g. `693.0` would indicate a stored multiplier × 100, which is a critical bug)
