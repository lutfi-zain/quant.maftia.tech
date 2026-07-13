## Context

The quantitative ecosystem consists of 4 distinct defense layers (`quant-btc-valuation-system`, `quant-btc-lttd-system`, `quant-btc-mttd-system`, and `quant-lttd-ichimoku`). The frontend terminal (`quant.maftia.tech/web`) provides deep-dive research sandboxes (`ValuationStudio.tsx`, `LttdLab.tsx`, `MttdConsole.tsx`, `IchimokuTerminal.tsx`) to inspect real-time metrics, interactive What-If scenario simulations, trade logs, and multi-pane subplots. To ensure absolute institutional rigor and transparency, every single metric card, trade record, equity curve, and interactive feature across all 4 studios must match $1:1$ strictly with the authoritative underlying research engines and feature sets established in each prior system repository (`../quant*`).

## Goals / Non-Goals

**Goals:**
- Enforce exact $1:1$ numerical parity ($|a-b| < 10^{-6}$) between frontend metric calculations and prior system backtest engines across all 4 defense studios for both full history windows and the default historical span (`2018-01-01` to `NOW()`).
- Guarantee zero lookahead bias by enforcing strictly causal $T-1$ position friction in frontend simulation hooks (`useStudioBacktest` and studio-specific simulation loops), where $Active\_Pos[t] = Pos[t-1]$.
- Audit and standardize all 4 studios to use the institutional 9-card metric grid (`Win Rate`, `Profit Factor`, `Total Trades`, `Sharpe Ratio vs Market`, `Ann. Return vs Market`, `Ann. Volatility vs Market`, `Max Drawdown vs Market`, and `Total Return vs Market`).
- Enforce strict charting standards across all multi-pane layouts: right Y-axis width locked to exactly `85px` (`rightPriceScale: { minimumWidth: 85 }`) and bidirectional real-time Vertical Crosshair Synchronization (`syncCrosshairs`).
- Maintain and verify automated Python verification harnesses (`verify_valuation_studio_metrics_1to1.py`, `verify_lttd_studio_metrics_1to1.py`, `verify_mttd_studio_metrics_1to1.py`, `verify_ichimoku_studio_metrics_1to1.py`, and `verify_pipeline_api_parity.py`) proving $100\%$ clean parity against `maftia_quant.db` and the Hono/Bun API Gateway (`:8765`).

**Non-Goals:**
- Out of scope: Modifying exchange ingestion feeds or raw BTC price series.
- Out of scope: Re-introducing or referencing the deprecated `quant-technical-indicator-bank`.

## Decisions

### 1. Causal $T-1$ Position Shifting in Studio Simulations
**Decision**: In `studioBacktest.ts` (`useStudioBacktest`) and studio simulation functions, the active position on day $t$ must be strictly extracted from the previous day's closing signal $t-1$: $Active\_Pos[t] = Pos[t-1]$.
**Rationale**: Eliminates lookahead bias where a position change generated at the close of day $t$ would erroneously capture day $t$'s intraday return.

### 2. Studio-Specific Gate and Override Architecture
**Decision**: Each studio must incorporate its exact domain gates and macro overrides directly in its causal extraction:
- **Valuation Studio**: `Active_Pos[t] = 0` if `valuation_composite[t-1] >= 1.50` (bubble warning), and `1` if `<= -1.00` (deep discount entry).
- **LTTD Lab**: `Active_Pos[t] = 1` only when `lttd_regime[t-1] === "BULL"` AND `lttd_prob_sideways[t-1] <= 0.60`. If `prob_sideways > 0.60`, forces `0.0` exposure (`SIDEWAYS` lock).
- **MTTD Console**: `Active_Pos[t] = 1` only when `mttd_imo[t-1] > 0.15` AND `mttd_er[t-1] >= 0.20` AND `mttd_entropy[t-1] <= 2.30`.
- **Ichimoku Terminal**: Sourced from `ichimoku_position` / `ichi_ref_pos` with reference vs strategy equity curves (`ichi_cum_strat` vs `ichi_cum_market`) displayed by default, and interactive What-If curves toggleable as overlays.

### 3. Universal 85px Y-Axis Lock & Crosshair Sync across Subplots
**Decision**: Every Lightweight Charts container in all 4 studios must pass `rightPriceScale: { minimumWidth: 85 }` on initialization and run DOM width measurement/synchronization (`syncYAxisWidth` and `syncCrosshairs`).
**Rationale**: Prevents horizontal time-tick misalignment between panes with large dollar values ($60,000+) vs bounded oscillators ($-1.0$ to $+1.0$).

## Risks / Trade-offs

- **[Risk] Column Naming Variations across SQLite / API Telemetry**: Some tables use `mttd_er` vs `mttd_er_ratio` or `mttd_entropy` vs `mttd_shannon_entropy`.
  - **Mitigation**: Implement robust fallback chains (`item.mttd_er ?? item.mttd_er_ratio ?? 0`) across both frontend client mappings (`client.ts`, studios) and verification harnesses.
- **[Risk] Warmup Period Null Gaps**: Early dates (`2009-2011`) lack sufficient historical bars for 120-bar Senkou B or 60-bar Chikou displacement.
  - **Mitigation**: All verification scripts and FE charts must filter out or gracefully handle NULL gaps during warmup without breaking series rendering.
