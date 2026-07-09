## 1. Full-Stack E2E Orchestration Harness (`run_e2e_suite.py`)

- [x] 1.1 Create `run_e2e_suite.py` in the project root to orchestrate backend pipeline execution (`python3 run_report_pipeline.py`) with SQLite WAL concurrency verification before server startup.
- [x] 1.2 Implement automated child process management in `run_e2e_suite.py` to start the Bun API Gateway (`bun run src/api/index.ts`) strictly bound to `0.0.0.0:8765` and verify its health endpoint (`/api/v1/health`).
- [x] 1.3 Implement Vite dev server management in `run_e2e_suite.py` to start the frontend (`npm run dev -- --port 5173`) inside `/web/` and verify its local HTTP accessibility.
- [x] 1.4 Add robust signal handling (`try/finally`, `atexit`, `SIGINT`/`SIGTERM` traps) inside `run_e2e_suite.py` to guarantee clean process termination and socket cleanup (`:8765` and `:5173`) after Playwright test execution.

## 2. Comprehensive Playwright E2E Test Suite (`web/tests/e2e-terminal.spec.ts`)

- [x] 2.1 Configure `web/playwright.config.ts` to connect to `http://localhost:5173` with automatic trace/screenshot capture on failure and appropriate retry thresholds.
- [x] 2.2 Create `web/tests/e2e-terminal.spec.ts` with global error monitoring (`page.on('console')` and `page.on('pageerror')`) that fails tests instantly on any JavaScript runtime exception, React rendering crash, or network request failure across all views.
- [x] 2.3 Implement navigation assertions across all 5 core application views: Master Executive Dashboard (`/`), Valuation Studio (`/valuation`), LTTD Lab (`/lttd`), MTTD Console (`/mttd`), and Ichimoku Terminal (`/ichimoku`).
- [x] 2.4 Add live DOM layout assertions in `web/tests/e2e-terminal.spec.ts` to inspect rendered Lightweight Charts (`.tv-lightweight-charts`) on every view, confirming that right Y-axis price scales strictly enforce `minimumWidth: 85` without horizontal drift.
- [x] 2.5 Implement real-time crosshair synchronization tests in `web/tests/e2e-terminal.spec.ts` by dispatching `mousemove` events across `MasterOHLCV` price chart canvases and asserting vertical alignment on all sibling subplots (`ValuationComposite`, `LTTDRegime`, `MTTDIntegratedOscillator`).
- [x] 2.6 Add data completeness assertions across all studios to verify that numeric/categorical indicator badges (`BULL`/`BEAR`/`SIDEWAYS`, `ER >= 0.20`, valuation score) and chart series render real data without `NaN`, `null`, `undefined`, or empty placeholders.

## 3. Execution & Automated Pipeline Verification

- [x] 3.1 Run `python3 /home/ubuntu/projects/run_report_pipeline.py` to verify full data synchronization across all 4 unified systems (`quant-btc-valuation-system`, `quant-btc-lttd-system`, `quant-btc-mttd-system`, and `quant-lttd-ichimoku`).
- [x] 3.2 Execute `python3 run_e2e_suite.py` to launch the full stack, run the complete Playwright E2E verification suite, and confirm 100% test pass rate with zero runtime errors.
