## Why

Phase 1 successfully established the foundational data layer (`MasterOHLCV` / `master_ohlcv`) with SQLite Write-Ahead Logging (`WAL`) mode across all subsystem databases (`maftia_quant.db`, `metrics.db`, `lttd.db`). However, the calculation engines across our four quantitative systems still run primarily as independent silos, and `run_report_pipeline.py` currently only aggregates text outputs into `latest_week_scores_report.md` without populating a consolidated, relational data store.

To achieve enterprise-grade quantitative defense and prepare for Phase 3 (API Gateway) and Phase 4 (Financial Terminal UI), Phase 2 must formally unify the calculation pipelines (`ValuationComposite`, `LTTDRegime`, `MTTDIntegratedOscillator`, and `IchimokuDenoisedOscillator`), enforce cross-system interlocking macro circuit breakers (`Valuation Composite >= +1.50` or LTTD `SIDEWAYS` HMM forcing `0.0` trend exposure), and persist all daily outputs into `UnifiedDailyAnalytics` (`unified_daily_analytics`) and `UnifiedComponentSignals` (`unified_component_signals`).

## What Changes

- **Core Engine Calculation & Bounding Standardization across all 4 Systems**:
  - `quant-btc-valuation-system`: Ensure the 17-indicator piecewise linear interpolated valuation score `[-2.0, +2.0]` correctly flags macro `CircuitBreakerFilter` (`score >= +1.50` bubble risk or `<= -1.00` deep discount).
  - `quant-btc-lttd-system`: Ensure the 3-State Gaussian HMM (`BULL`, `BEAR`, `SIDEWAYS`) regime classification derived from Log Returns and 20-day Volatility exposes explicit probabilities ($P_{\text{Sideways}}$).
  - `quant-btc-mttd-system`: Standardize the consensus oscillator `[-1.0, +1.0]` across 10 statistical families governed by strict gates (`EfficiencyRatioGate >= 0.20`, `ShannonEntropyGate <= 2.30`, and `ChikouMomentumExit < -0.30`).
  - `quant-lttd-ichimoku`: Standardize the stationary bounded $\tanh$ oscillator `[-1.0, +1.0]` (`ichimoku_imo`) transformed from non-stationary Ichimoku cloud components filtered via Ehlers 2-pole `SuperSmoother` IIR transfer function.
- **Cross-System Interlocking Circuit Breakers & Regime Overrides**:
  - Implement LTTD `SIDEWAYS` Macro Override: When `regime == SIDEWAYS` ($P_{\text{Sideways}} > 0.60$), force `mttd_position = 0.0` and `ichimoku_position = 0.0` regardless of individual oscillator readings.
  - Implement Valuation Circuit Breaker Hook: When `valuation_composite >= +1.50`, restrict or cap new long exposure across LTTD, MTTD, and Ichimoku systems to prevent top-of-cycle risk.
- **Relational Persistence in `maftia_quant.db`**:
  - Extend `run_report_pipeline.py` to create and populate `unified_daily_analytics` (`date`, `valuation_composite`, `lttd_regime`, `lttd_score`, `mttd_imo`, `mttd_er`, `mttd_entropy`, `mttd_position`, `ichimoku_imo`, `ichimoku_regime`, `ichimoku_position`) using parameterized queries and SQLite WAL concurrency.
  - Create and populate `unified_component_signals` (`date`, `system_source`, `component_name`, `raw_value`, `normalized_score`, `signal_direction`) to track the 17 Valuation metrics, LTTD indicators, and MTTD statistical family components.
- **Strict $t-1$ Causal Filter Verification**:
  - Guarantee zero lookahead bias across all mathematical transformations, normalizations, and rolling windows. Every signal on date $t$ must strictly be derived from data available on or before $t-1$.

## Capabilities

### New Capabilities
- `quant-engines-unification`: Standardizes the mathematical outputs, score normalization (`[-2.0, +2.0]` and `[-1.0, +1.0]`), and internal structure across all 4 quantitative engines (`ValuationComposite`, `LTTDRegime`, `MTTDIntegratedOscillator`, and `IchimokuDenoisedOscillator`) with strict causal verification.
- `interlocking-circuit-breakers`: Implements cross-system macro override rules, specifically forcing `0.0` trend exposure on mid-term systems (`MTTD` and `Ichimoku`) when LTTD Gaussian HMM detects `SIDEWAYS` ($P_{\text{Sideways}} > 0.60$), and applying valuation circuit breakers when `ValuationComposite >= +1.50`.
- `unified-analytics-persistence`: Manages the database schemas and automated data synchronization pipeline in `run_report_pipeline.py` to persist unified daily scores (`unified_daily_analytics`) and granular component metrics (`unified_component_signals`) in SQLite WAL mode.

### Modified Capabilities
<!-- No existing capability requirements in openspec/specs/ are being changed; new specs are introduced for Phase 2 capabilities. -->

## Impact

- **Impacted Systems (All 4 Unified Systems)**:
  1. `quant-btc-valuation-system`: Output interfaces consumed during unified synchronization.
  2. `quant-btc-lttd-system`: Output interfaces (`final_score`, `regime`, probability distribution) consumed during unified synchronization.
  3. `quant-btc-mttd-system`: Position exposure overridden when `SIDEWAYS` override is active.
  4. `quant-lttd-ichimoku`: Position exposure overridden when `SIDEWAYS` override is active.
- **Orchestration**: `run_report_pipeline.py` upgraded to write directly into `unified_daily_analytics` and `unified_component_signals` inside `maftia_quant.db`.
- **Database**: Adds two new relational tables (`unified_daily_analytics`, `unified_component_signals`) with foreign key alignment to `master_ohlcv`.

## Non-goals

- **No Frontend UI Development**: Phase 4 will handle the React 19 + Vite + Lightweight Charts v5.2 financial terminal UI. Phase 2 is strictly focused on backend quantitative engines, math verification, and relational storage.
- **No API Gateway Server Creation**: Phase 3 will introduce the Hono v4 + Bun API Gateway (`api.quant.maftia.tech:8765`). No temporary or ad-hoc servers will be created in Phase 2.
- **No Deprecated Indicator Bank Usage**: Under no circumstances will the legacy `quant-technical-indicator-bank` (`05. Indicator Bank`) system or its components be referenced, imported, modified, or re-introduced.
