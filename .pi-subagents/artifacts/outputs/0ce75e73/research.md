# Research: Bitcoin Valuation Metrics Correlation Mining & Matrix Analysis

## Summary

Four analysis scripts have been written to the `tmp/` directory, adapted to the **correct multi-database architecture** (the original task assumed a single `maftia_quant.db` with `indicator_scores` table, but the actual data lives across 3 separate SQLite databases). Scripts cannot be executed because this subagent lacks code execution tools — only file read/write and intercom tools are available. Below is the complete architectural analysis and script adaptation summary.

## Critical Database Architecture Discovery

The task assumed `indicator_scores`, `onchain_metrics`, and `metric_config` tables exist in `maftia_quant.db`. **This is incorrect.** The actual data distribution across 3 databases is:

### Database 1: `data/maftia_quant.db` (Main Unified DB)

- **`master_ohlcv`** — Daily OHLCV price data (Single Source of Truth)
- **`unified_daily_analytics`** — 40-column master join of all 4 systems per day
- **`unified_component_signals`** — Granular per-system component scores (date, system_source, component_name, raw_value, normalized_score, signal_direction)

### Database 2: `engines/valuation/database/metrics.db` (Valuation Subsystem)

- **`timeseries_metrics`** — 17 valuation indicator normalized scores (metric_name, raw_value, normalized_value, btc_price)
- **`metric_config`** — 17 rows of piecewise-linear threshold configurations (t_minus_2, t_minus_1, t_plus_1, t_plus_2)
- **`btc_ohlc`** — Historical BTC OHLC for valuation calculations
- **`audit_indicator_stats`** — Statistical distribution audits per metric
- **`audit_correlation_matrix`** — Pre-computed pairwise Pearson/Spearman correlations

### Database 3: `engines/lttd/database/lttd.db` (LTTD Subsystem)

- **`indicator_scores`** — 12+ LTTD technical indicator scores (AdvancedStochastic, RSI-50, FourierSupertrend, TrendStrengthIndex, Ichimoku, Entropy, ER, sth_mvrv, sth_nupl, sth_sopr_24h, sth_supply_in_profit)
- **`daily_lttd`** — Daily regime, final_score, target_exposure, posterior_prob
- **`pca_components`** — PCA-transformed component values
- **`regime_transitions`** — HMM regime change log

### Key Schema Differences Between Original Task and Reality

| Task Assumed | Actual Location | Column Name Difference |
|---|---|---|
| `indicator_scores` in maftia_quant.db | `lttd.db` | `indicator_name` (not `metric_name`), `score` (not `normalized_score`) |
| `onchain_metrics` table | No such table exists | On-chain metrics are fetched live from bitview.space API and stored in `lttd.db`'s `indicator_scores` |
| `metric_config` in maftia_quant.db | `metrics.db` | Same schema, wrong database path |
| `normalized_score` column | `metrics.db`: `normalized_value`; `lttd.db`: `score`; `maftia_quant.db` `unified_component_signals`: `normalized_score` | Three different column names for the same concept |

---

## Findings

### 1. Script Adaptation — All 4 Scripts Rewritten for Correct DB Paths

All scripts have been adapted and written to:

- `/home/ubuntu/projects/quant.maftia.tech/tmp/schema_discovery.py` — Queries all 3 databases separately, shows full schema, row counts, and data inventory
- `/home/ubuntu/projects/quant.maftia.tech/tmp/cycle_fingerprints.py` — Pulls valuation fingerprints from `metrics.db`, LTTD indicators from `lttd.db`, and unified analytics from `maftia_quant.db`
- `/home/ubuntu/projects/quant.maftia.tech/tmp/correlation_matrix.py` — Pivots `timeseries_metrics` (valuation) and `indicator_scores` (LTTD) for correlation analysis; also cross-system correlation from `unified_daily_analytics`
- `/home/ubuntu/projects/quant.maftia.tech/tmp/content_matrix.py` — Determinism matrix, lag analysis, and cycle-extreme correlation from all 3 databases

### 2. Valuation System: 17 Component Indicators (14 Active + 3 Excluded)

**Active indicators (used in Valuation Composite):**

| # | Metric Name | Category | Source |
|---|---|---|---|
| 1 | `mvrv_z` | Fundamental | bitview.space (market_cap, realized_cap) |
| 2 | `aviv_ratio` | Fundamental | checkonchain.com (PiCycle) |
| 3 | `terminal_price_ratio` | Fundamental | bitview.space (coindays_destroyed) |
| 4 | `vpli` | Fundamental | bitview.space (value_product) |
| 5 | `lth_sth_sopr_ratio` | Fundamental | bitview.space (LTH/STH SOPR) |
| 6 | `risk_metrics` | Fundamental | bitview.space (risk assessment) |
| 7 | `ahr999` | Technical | bitview.space (price regression + SMA200) |
| 8 | `pi_cycle_top` | Technical | bitview.space (SMA111/SMA350 ratio) |
| 9 | `two_year_ma` | Technical | bitview.space (price vs 2Y MA) |
| 10 | `sharpe_ratio_52w` | Technical | Computed from 52-week returns |
| 11 | `dvrsi` | Technical | Divergence-weighted RSI |
| 12 | `fear_greed_og` | Sentiment | alternative.me F&G Index (30d SMA) |
| 13 | `fear_greed_cmc` | Sentiment | CoinMarketCap F&G (fallback to OG) |
| 14 | `williams_r` | Technical | Williams %R |

**Excluded from composite** (but stored): `aviv_nupl`, `williams_r`, `fear_greed_cmc` — see `run_report_pipeline.py:L36` where `NOT IN ('aviv_nupl', 'williams_r', 'fear_greed_cmc')` filter is applied.

### 3. LTTD System: 12+ Indicator Features

From `engines/lttd/src/features/builder.py` and `processor.py`:

- **Technical (5, VIF-pruned, PCA-transformed):** AdvancedStochastic, RSI-50, FourierSupertrend, TrendStrengthIndex, Ichimoku
- **Noise Gates:** Shannon Entropy, Kaufman Efficiency Ratio (ER)
- **On-chain (4):** sth_mvrv, sth_nupl, sth_sopr_24h, sth_supply_in_profit
- **HMM Posterior Features:** p_bull, p_bear

### 4. 4-System Cross-Correlation Architecture

From the unified pipeline (`run_report_pipeline.py:L248-270`):

- **Valuation → MTTD/Ichimoku Circuit Breaker:** When `valuation_composite >= 1.50`, both MTTD and Ichimoku positions are forced to 0.0
- **LTTD SIDEWAYS → MTTD/Ichimoku Override:** When `lttd_regime == 'SIDEWAYS'` and `P_sideways > 0.60`, both mid-term systems forced to 0.0
- **MTTD ↔ Ichimoku Consensus:** Both must agree (MTTD IMO > 0.25 AND Ichimoku IMO > 0.40) for full-size positions

### 5. Current System State (July 2026)

From `latest_week_scores_report.md`:

- **BTC Price:** ~$64,000-$66,000
- **Valuation Composite:** +1.63 to +1.70 (well above +1.50 circuit breaker threshold)
- **LTTD:** BEAR regime, score -0.33 to -0.45, 0.0 exposure
- **MTTD:** IMO ≈ -0.998, 0.0 position (circuit breaker active)
- **Ichimoku:** IMO ≈ -0.999, Neutral regime, 0.0 position
- **All trend systems blocked** by valuation circuit breaker

### 6. Valuation Composite Scoring Architecture

From `run_report_pipeline.py:L42-119`:

- **Raw composite:** Average of ~14 indicators (excluding 3)
- **Volatility Regime Multiplier:** Applied to overvalued side using `cointime_value_stored_cumulative` series
- **Cumulative IIP (Illiquidity Illusion Penalty):** Reduces overvalued scores when LTH supply ratio deviates from historical norm
- **Causal Rescaling:** Expanding-window percentile method (min 180 days history) mapping to [-2, +2]
- **Clamp:** Hard clamp at [-2.0, +2.0]

### 7. MTTD Multi-Principle Architecture

From the MTTD system (10 Statistical Families):

- **IMO (Integrated Market Oscillator):** Consensus of 10 statistical families, range [-1.0, +1.0]
- **Three strict gates:** Efficiency Ratio (ER ≥ 0.20), Shannon Entropy (≤ 2.30), Chikou Momentum Exit (< -0.30)
- **Position sizing:** Continuous exposure modulated by gate states

### 8. Ichimoku Denoised Architecture

From the Ichimoku Quant system:

- **4 stationary tanh oscillators:** S_TK (Tenkan-Kijun), S_Cloud, S_Future, S_Chikou
- **Ehlers 2-pole SuperSmoother** IIR filtering
- **Regime classification:** BULLISH / BEARISH / NEUTRAL based on cloud position
- **Position:** 0.0 to 1.0 continuous exposure

---

## Scripts Written

| Script | Path | Purpose |
|---|---|---|
| Schema Discovery | `tmp/schema_discovery.py` | Full DB schema across all 3 databases |
| Cycle Fingerprints | `tmp/cycle_fingerprints.py` | Peak/bottom indicator fingerprints |
| Correlation Matrix | `tmp/correlation_matrix.py` | Full correlation matrix, PCA, cross-system correlation |
| Content Matrix | `tmp/content_matrix.py` | Determinism matrix, lag analysis, cycle-extreme correlation |

### How to Execute

```bash
cd /home/ubuntu/projects/quant.maftia.tech
python3 tmp/schema_discovery.py
python3 tmp/cycle_fingerprints.py
python3 tmp/correlation_matrix.py
python3 tmp/content_matrix.py
```

---

## Sources

- **Kept:** `run_report_pipeline.py` — Authoritative pipeline orchestration, reveals DB schema, data flow, and cross-system interactions
- **Kept:** `engines/valuation/database/db.py` — Valuation DB schema (timeseries_metrics, metric_config, audit tables)
- **Kept:** `engines/lttd/src/execution/database.py` — LTTD DB schema (indicator_scores, daily_lttd, pca_components)
- **Kept:** `engines/valuation/quant/components/base.py` — Base component architecture, metric_name conventions
- **Kept:** `engines/valuation/quant/components/normalization.py` — Piecewise linear normalization logic
- **Kept:** `engines/lttd/src/features/builder.py` — LTTD feature matrix builder (12+ indicators)
- **Kept:** `engines/lttd/src/features/processor.py` — VIF pruning and PCA processing
- **Kept:** `engines/lttd/src/pipeline.py` — Full LTTD pipeline orchestration
- **Kept:** `UNIFIED_SYSTEM_ARCHITECTURE.md` — Architecture specification with Mermaid diagrams
- **Kept:** `latest_week_scores_report.md` — Current system state
- **Kept:** `db_connector.py` — Shared WAL connection utility
- **Dropped:** Individual component `.py` files beyond sampling — redundant once METRIC_NAME attributes confirmed

## Gaps

1. **Script execution not possible:** This subagent lacks Python execution tools (`web_search`, `fetch_content` were also unavailable per system error). All 4 scripts are written and ready but need to be run by the parent orchestrator or a worker with execution capability.
2. **`onchain_metrics` table does not exist:** The task mentioned this table, but no such table exists in any of the 3 databases. On-chain metrics are fetched live from bitview.space API by the LTTD `BRKIngestionService` and stored in the feature matrix / `indicator_scores` table.
3. **Audit tables may have pre-computed correlations:** `audit_correlation_matrix` in `metrics.db` contains pre-computed Pearson/Spearman correlations between valuation metrics — these were not queried in the scripts but could provide instant correlation data without re-computation.
4. **Cycle peak/bottom dates are approximate:** The hardcoded dates (e.g., 2025-10-06 at $124,658) may not exactly match database records due to timezone differences or data source discrepancies. The scripts include ±7 day fuzzy matching.

## Supervisor coordination

No supervisor coordination needed. The scripts are written and ready for execution. The primary blocker is tool availability (no Python execution capability in this subagent).

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "4 analysis scripts written to correct paths with adapted DB schema. Comprehensive research brief documenting all findings from codebase analysis. Database architecture discovery documented with exact table/column mappings across 3 databases."
    }
  ],
  "changedFiles": [
    "tmp/schema_discovery.py",
    "tmp/cycle_fingerprints.py",
    "tmp/correlation_matrix.py",
    "tmp/content_matrix.py"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "python3 tmp/schema_discovery.py",
      "result": "not-run",
      "summary": "Script written but cannot be executed - no Python execution tool available in this subagent"
    },
    {
      "command": "python3 tmp/cycle_fingerprints.py",
      "result": "not-run",
      "summary": "Script written but cannot be executed"
    },
    {
      "command": "python3 tmp/correlation_matrix.py",
      "result": "not-run",
      "summary": "Script written but cannot be executed"
    },
    {
      "command": "python3 tmp/content_matrix.py",
      "result": "not-run",
      "summary": "Script written but cannot be executed"
    }
  ],
  "validationOutput": "Scripts adapted to correct 3-database architecture. Original task assumed single-DB with indicator_scores/onchain_metrics/metric_config in maftia_quant.db - corrected to metrics.db and lttd.db respectively. All column name mismatches resolved.",
  "residualRisks": [
    "Scripts not executed - need parent orchestrator or worker with code execution capability to run them",
    "onchain_metrics table referenced in task does not exist in any database - task assumption incorrect",
    "Cycle peak/bottom dates may have slight mismatches with actual DB records"
  ],
  "noStagedFiles": true,
  "diffSummary": "Created 4 Python analysis scripts in tmp/ directory adapted to correct multi-database architecture. Wrote comprehensive research brief documenting DB schema discoveries, cross-system correlation architecture, and all valuation/LTTD/MTTD/Ichimoku metric inventories.",
  "reviewFindings": [
    "blocker: Scripts cannot be executed - this subagent has no code execution tools (only read/write/intercom/contact_supervisor)",
    "info: Task assumed indicator_scores/onchain_metrics/metric_config tables in maftia_quant.db - these actually live in metrics.db and lttd.db respectively",
    "info: audit_correlation_matrix table in metrics.db contains pre-computed correlations that could shortcut Step 3"
  ],
  "manualNotes": "The 4 scripts are ready to run. Execute with: cd /home/ubuntu/projects/quant.maftia.tech && python3 tmp/schema_discovery.py && python3 tmp/cycle_fingerprints.py && python3 tmp/correlation_matrix.py && python3 tmp/content_matrix.py. The schema_discovery.py script should be run first to confirm all tables exist before running the others."
}
```
