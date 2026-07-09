## Why

The current Playwright testing suite (`web/tests/chart-sync.spec.ts`) only performs static string and regex inspections of React source code rather than launching a live browser session to verify actual runtime behavior. To guarantee that all 4 unified quantitative systems (`quant-btc-valuation-system`, `quant-btc-lttd-system`, `quant-btc-mttd-system`, and `quant-lttd-ichimoku`) function flawlessly end-to-end across both Frontend (React 19 + Lightweight Charts v5.2) and Backend (Python 3.11+ pipeline and Hono v4 API Gateway on port `:8765`), we need an exhaustive end-to-end live testing harness. This ensures zero runtime console errors, zero data rendering anomalies (`NaN` or `undefined`), strict `85px` right Y-axis locking, and exact vertical crosshair synchronization across all executive dashboard and deep-dive sandboxes.

## What Changes

- **Full-Stack Orchestrated E2E Test Suite**: Create an end-to-end full-stack testing harness (`run_e2e_suite.py` and `web/tests/e2e-terminal.spec.ts`) that orchestrates data generation via `python3 run_report_pipeline.py`, starts the Hono API Gateway (`bun run src/api/index.ts` on `0.0.0.0:8765`), starts the Vite frontend dev server (`npm run dev` on `:5173`), and runs Playwright against the live stack.
- **Live Browser Playwright Verification**: Expand Playwright testing to visit all 5 core application views: Master Executive Dashboard (`/`), Valuation Studio (`/valuation`), LTTD Lab (`/lttd`), MTTD Console (`/mttd`), and Ichimoku Terminal (`/ichimoku`).
- **Runtime Error & Console Inspection**: Automatically listen to all browser `console.error` and `pageerror` events during Playwright execution, failing tests immediately if any JavaScript runtime exception, React rendering crash, or failed network request occurs.
- **Data Completeness & Zero-NaN Visual Assertion**: Verify that all telemetry metrics (`MasterOHLCV`, `ValuationComposite`, `LTTDRegime`, `MTTDIntegratedOscillator`, `IchimokuDenoisedOscillator`) render visible chart series and numerical indicator badges without displaying `NaN`, `null`, `undefined`, or empty fallback states.
- **Live DOM 85px & Crosshair Assertion**: Upgrade chart verification from static file reading to live DOM layout inspection, checking that every subplot's right price axis canvas width is strictly `85px` and simulating mouse hover events to confirm real-time crosshair coordinate synchronization without horizontal drift across all subplots.
- **Zero Lookahead & Causal Verification**: Ensure all backend API payloads consumed by the frontend strictly enforce causal filtering ($t-1$ verification) with no future timestamp leaks beyond current server date `today`.

### Non-goals
- Modifying core quantitative calculation formulas inside the 4 unified backend systems (`quant-btc-valuation-system`, `quant-btc-lttd-system`, `quant-btc-mttd-system`, `quant-lttd-ichimoku`), except where necessary to resolve data formatting or serialization bugs surfaced during E2E testing.
- Any interaction with or re-introduction of deprecated legacy projects such as `quant-technical-indicator-bank` (`05. Indicator Bank`), which remains explicitly removed and untouched.

## Capabilities

### New Capabilities
- `e2e-fullstack-testing`: Defines requirements for the full-stack automated testing harness (`run_e2e_suite.py`) that boots up the Python pipeline, Hono API Gateway (`:8765`), and Vite frontend (`:5173`), running Playwright browser assertions across all 4 quantitative systems to guarantee end-to-end reliability.

### Modified Capabilities
- `terminal-visual-verification`: Modifies the existing requirement from static code checks to live Playwright browser verification across all 5 UI views (Dashboard and 4 Studios), asserting zero console/page runtime errors, complete numeric display without `NaN`/`undefined`, live DOM `85px` right Y-axis width locking, and vertical crosshair synchronization.

## Impact

- **Affected Systems**: All 4 unified quantitative systems (`quant-btc-valuation-system`, `quant-btc-lttd-system`, `quant-btc-mttd-system`, and `quant-lttd-ichimoku`), Backend API Gateway (`src/api/server.ts` / `src/api/index.ts`), and Frontend UI SPA (`web/src/`).
- **Affected Code & Scripts**: Adds `run_e2e_suite.py` in the repository root, updates `web/playwright.config.ts`, and adds/expands Playwright test files in `web/tests/e2e-terminal.spec.ts`.
- **Dependencies**: Uses existing Playwright (`@playwright/test`), Bun runtime, and Python virtual environment with SQLite WAL concurrency support.
