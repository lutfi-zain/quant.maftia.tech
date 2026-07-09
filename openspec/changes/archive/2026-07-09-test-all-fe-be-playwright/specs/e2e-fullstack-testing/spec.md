# Full-Stack E2E Testing Harness Specification

## ADDED Requirements

### Requirement: Full-Stack Test Orchestration Pipeline
The system SHALL provide a Python orchestration runner (`run_e2e_suite.py`) that automates the complete execution of data ingestion, API server startup, frontend server startup, and Playwright end-to-end verification.

#### Scenario: End-to-end test runner execution
- **WHEN** `python3 run_e2e_suite.py` is invoked from the command line
- **THEN** it MUST sequentially:
  1. Execute `python3 run_report_pipeline.py` to ensure `MasterOHLCV` (`master_ohlcv`) and `UnifiedDailyAnalytics` (`unified_daily_analytics`) are populated with valid daily calculations across all 4 systems (`Valuation`, `LTTD`, `MTTD`, and `Ichimoku`) using SQLite WAL concurrency
  2. Launch the Bun backend API Gateway (`bun run src/api/index.ts`) bound explicitly to `0.0.0.0:8765`
  3. Launch the Vite frontend dev server (`npm run dev`) inside `web/` bound to port `:5173`
  4. Wait for both HTTP server health endpoints (`http://127.0.0.1:8765/api/v1/health` and `http://localhost:5173`) to return `200 OK`
  5. Execute the Playwright test runner (`npx playwright test`) inside `web/` to verify visual and functional integrity across all components and studios

### Requirement: Automated Process and Port Lifecycle Cleanup
The orchestration harness (`run_e2e_suite.py`) SHALL ensure that any background server processes, open network sockets (`:8765` and `:5173`), and SQLite WAL handles are cleanly terminated upon test completion or failure.

#### Scenario: Clean teardown on test completion or interruption
- **WHEN** the Playwright test suite completes (with exit code 0 or non-zero) or the orchestrator process receives an interrupt signal (`SIGINT` or `SIGTERM`)
- **THEN** the orchestrator MUST terminate the Bun API Gateway child process and Vite dev server child process, release ports `:8765` and `:5173`, and ensure no orphaned database lock remains on `maftia_quant.db`

### Requirement: Comprehensive Coverage Across All 4 Quantitative Systems
The full-stack testing harness SHALL run verification checks against all 4 unified quantitative defense systems and confirm that no legacy or deprecated components are executed.

#### Scenario: Verification of active quantitative pillars
- **WHEN** the E2E suite runs against the live API and UI
- **THEN** it SHALL verify metrics and UI rendering for:
  - `quant-btc-valuation-system`: `ValuationComposite` score `[-2.0, +2.0]` and `CircuitBreakerFilter` (`>= +1.50`)
  - `quant-btc-lttd-system`: `LTTDRegime` (`BULL`, `BEAR`, `SIDEWAYS`) and `SIDEWAYS` zero-exposure lock
  - `quant-btc-mttd-system`: `MTTDIntegratedOscillator` (`[-1.0, +1.0]`) with `EfficiencyRatioGate` (`>= 0.20`), `ShannonEntropyGate` (`<= 2.30`), and `ChikouMomentumExit` (`< -0.30`)
  - `quant-lttd-ichimoku`: `IchimokuDenoisedOscillator` (`[-1.0, +1.0]`) filtered via Ehlers 2-pole `SuperSmoother` IIR
- **AND THEN** it MUST NOT invoke or reference any deprecated modules from `quant-technical-indicator-bank` (`05. Indicator Bank`)
