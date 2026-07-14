## 1. Directory Setup

- [x] 1.1 Create `docs/architecture/` directory in the `quant.maftia.tech` repo

## 2. E2E Master Architecture Document (`00_end_to_end.md`)

- [x] 2.1 Write navigation header with links to all 5 architecture docs
- [x] 2.2 Write system overview prose: 5-layer platform description (Data Sources → Orchestration → Storage → API Gateway → Frontend SPA)
- [x] 2.3 Create Mermaid `graph TD` master flowchart with 5 `subgraph` groups, styled with Bloomberg dark palette (matching UNIFIED_SYSTEM_ARCHITECTURE.md convention)
- [x] 2.4 Add `MasterOHLCV` data sources section: Binance OHLCV feed, `bitview.space` BRK API (sth_mvrv, sth_nupl, sth_sopr, sth_supply), Fear&Greed / Funding Rates
- [x] 2.5 Add orchestration layer section documenting `run_report_pipeline.py` as the sequential controller with WAL connection lifecycle
- [x] 2.6 Add unified storage section: `maftia_quant.db` tables (`master_ohlcv`, `unified_daily_analytics`, `unified_component_signals`) and subsystem `.db` files (`metrics.db`, `lttd.db`)
- [x] 2.7 Add API gateway section: Hono v4 + Bun on port `:8910`, bound to `0.0.0.0`, key REST routes and WebSocket `/api/v1/ws/crosshair`
- [x] 2.8 Add frontend SPA section: React 19 + Vite + TypeScript, Executive Dashboard + 4 Deep-Dive Studios, Lightweight Charts v5.2 with 85px Y-axis lock
- [x] 2.9 Create Mermaid `sequenceDiagram` for the daily `run_report_pipeline.py` run (actors: Pipeline, ValuationEngine, LTTDEngine, MTTDEngine, IchimokuEngine, SQLite, APIGateway)
- [x] 2.10 Create Mermaid `flowchart LR` for cross-system interlocking circuit breaker matrix (Valuation→LTTD→MTTD+Ichimoku with threshold labels)
- [x] 2.11 Write inter-system dependency table (4 rows × 4 columns: which system depends on which, what signal, what override action)
- [x] 2.12 Write navigation footer with prev/next links

## 3. Valuation System Doc (`01_valuation_system.md`)

- [x] 3.1 Write navigation header and role summary: 17-indicator piecewise linear `ValuationComposite` score `[-2.0, +2.0]`, macro CircuitBreakerFilter
- [x] 3.2 Create Mermaid `graph TD` flowchart: Layer 0 (BRK API + OHLCV) → Layer 1 (17 indicators grouped by pillar) → Layer 2 (piecewise linear interpolation) → Layer 3 (score clamp) → Layer 4 (circuit breaker evaluation) → Layer 5 (persistence to `metrics.db`) → Layer 6 (API + ValuationStudio)
- [x] 3.3 Write 17-indicator component table grouped by pillar: Fundamental (on-chain), Technical (price/momentum), Sentiment (social/macro) — with score range and signal direction columns
- [x] 3.4 Write CircuitBreakerFilter logic: `score >= +1.50` (bubble risk → LTTD exposure cap) and `score <= -1.00` (deep discount → LTTD exposure boost)
- [x] 3.5 Write `metrics.db` schema excerpt (tables: `timeseries_metrics`, `audit_composite_params`, `valuation_composite`) in SQL code block
- [x] 3.6 Write relevant API routes table: `GET /api/v1/system/valuation/details`, `GET /api/v1/timeseries/master`
- [x] 3.7 Write ValuationStudio frontend wiring: component tree, data fetch hook, chart subplots (ValuationComposite + BTC price + 17 component scores)
- [x] 3.8 Write navigation footer

## 4. LTTD System Doc (`02_lttd_system.md`)

- [x] 4.1 Write navigation header and role summary: 3-State Gaussian HMM (`BULL/BEAR/SIDEWAYS`), `LTTDRegime`, exposure sizing
- [x] 4.2 Create Mermaid `graph TD` 6-layer flowchart: Layer 0 (OHLCV + on-chain) → Layer 1 (Log Returns + 20d Realized Vol → HMM → P_Bull/Bear/Sideways) → Layer 2 (12 tech indicators + 4 on-chain → causal filter) → Layer 3 (Z-score → VIF pruning → PCA top-3) → Layer 4 (XGBoost/L1-Lasso ensemble + WFO) → Layer 5 (regime-weighted sizing + SIDEWAYS override circuit breaker) → Layer 6 (lttd.db → API → LTTD Lab)
- [x] 4.3 Write HMM 3-state table: State 0 (BULL), State 1 (BEAR), State 2 (SIDEWAYS) with posterior probability thresholds
- [x] 4.4 Write SIDEWAYS macro override decision block: `P_Sideways > 0.60 → target_exposure = 0.0`; highlighted as the primary risk gate
- [x] 4.5 Write PCA + VIF orthogonalization section: VIF pruning (`VIF > 10`), PCA k=3 (≥85% variance), Pratt's Relative Importance
- [x] 4.6 Write WFO training schedule: 3yr Train → 6mo Validation → 6mo Out-of-Sample
- [x] 4.7 Write `lttd.db` schema excerpt (tables: `daily_lttd`, `indicator_scores`, `ohlcv`) in SQL code block
- [x] 4.8 Write API routes table and LTTD Lab frontend wiring: component tree, regime color coding, continuous `lttd_target_exposure` backtest binding
- [x] 4.9 Write navigation footer

## 5. MTTD System Doc (`03_mttd_system.md`)

- [x] 5.1 Write navigation header and role summary: multi-principle consensus oscillator `[-1.0, +1.0]`, 10 statistical families, 3 strict gates
- [x] 5.2 Create Mermaid `graph TD` flowchart: OHLCV input → 10 statistical family modules → raw signal aggregation → EfficiencyRatioGate (`ER >= 0.20`) → ShannonEntropyGate (`Entropy <= 2.30`) → MTTDIntegratedOscillator (`[-1.0, +1.0]`) → ChikouMomentumExit (`< -0.30`) → position output → persistence → MTTD Console
- [x] 5.3 Write 10 statistical families table: family name, sub-indicator examples, output type
- [x] 5.4 Write EfficiencyRatioGate section: Kaufman ER formula `|Close_t - Close_{t-n}| / Σ|Close_i - Close_{i-1}|`, threshold `>= 0.20`, blocking behavior
- [x] 5.5 Write ShannonEntropyGate section: rolling 15d histogram (6 bins) formula `H = -Σp_i log2(p_i)`, threshold `<= 2.30`, chaotic regime block
- [x] 5.6 Write ChikouMomentumExit section: exit trigger `S_Chikou < -0.30`, dynamic immunity logic, crash ROC circuit breaker `< -0.20`
- [x] 5.7 Write `mttd_data.json` / SQLite schema and API routes table
- [x] 5.8 Write MTTD Console frontend wiring: oscillator chart, gate status indicators, position history
- [x] 5.9 Write navigation footer

## 6. Ichimoku Quant System Doc (`04_ichimoku_system.md`)

- [x] 6.1 Write navigation header and role summary: stationary bounded `tanh` oscillator `[-1.0, +1.0]`, Ehlers 2-pole SuperSmoother IIR, 5-gate confirmation
- [x] 6.2 Create Mermaid `graph TD` 5-layer flowchart: Layer 1 (Spectral Filtering: Ehlers SuperSmoother → tanh decomposition S_TK/S_Cloud/S_Future/S_Chikou → IMO) → Layer 2 (Fractal Gate: ER >= 0.25) → Layer 3 (Entropy Gate: Entropy <= 2.271) → Layer 4 (Cloud Boundary Gate: Close >= min(SenkouA, SenkouB)) → Layer 5 (Signal Confirmation: 2-bar persistence → entry/exit logic)
- [x] 6.3 Write tanh decomposition formulas for all 4 components (S_TK, S_Cloud, S_Future, S_Chikou) in math/code block notation
- [x] 6.4 Write SuperSmoother IIR transfer function: `y_t = c1*(xt + xt-1)/2 + c2*yt-1 + c3*yt-2` with coefficient derivation note
- [x] 6.5 Write Integrated Market Oscillator (IMO) formula and SuperSmoother final smoothing with `l=7` cutoff
- [x] 6.6 Write 5-gate logic decision table (Gate, Condition, Threshold, Fail Action)
- [x] 6.7 Write formal statistical validation table: 5 tests (ADF, KS, Welch's t-test, Bootstrap CI, Bonferroni), null hypothesis, result, quantitative implication
- [x] 6.8 Write `ichimoku` subsystem storage schema and API routes table
- [x] 6.9 Write Ichimoku Terminal frontend wiring: 4-component oscillator subplots, 5-gate status panel, position history
- [x] 6.10 Write navigation footer

## 7. Verification

- [x] 7.1 Verify all 5 files exist in `docs/architecture/`
- [x] 7.2 Verify all cross-links between docs resolve correctly (relative paths)
- [x] 7.3 Verify all Mermaid diagrams parse without syntax errors (check for unquoted special chars in labels)
- [x] 7.4 Verify no references to deprecated `quant-technical-indicator-bank` appear in any doc
- [x] 7.5 Verify DDD ubiquitous language used consistently throughout: `MasterOHLCV`, `ValuationComposite`, `LTTDRegime`, `MTTDIntegratedOscillator`, `IchimokuDenoisedOscillator`, `UnifiedDailyAnalytics`, `UnifiedComponentSignals`
