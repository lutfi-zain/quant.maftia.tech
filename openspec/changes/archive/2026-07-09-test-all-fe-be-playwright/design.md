## Context

The `quant.maftia.tech` platform unites 4 core quantitative and statistical defense systems (`quant-btc-valuation-system`, `quant-btc-lttd-system`, `quant-btc-mttd-system`, and `quant-lttd-ichimoku`) into a single high-end financial terminal. Currently, automated testing (`web/tests/chart-sync.spec.ts`) only reads source code strings (`fs.readFileSync`) to check if `minimumWidth: 85` or `subscribeCrosshairMove` are written in TypeScript files. This static check misses runtime issues such as API gateway connection errors, SQLite WAL locking failures, WebSocket payload schema mismatches, `NaN`/`undefined` data rendering, or browser DOM rendering crashes across React 19 and Lightweight Charts v5.2.

To verify comprehensive system reliability across all 4 pillars, we are designing a unified full-stack automated E2E test orchestration framework (`run_e2e_suite.py`) coupled with a comprehensive live Playwright test suite (`web/tests/e2e-terminal.spec.ts`).

## Goals / Non-Goals

**Goals:**
- **Full-Stack Orchestration**: Build a Python orchestration script (`run_e2e_suite.py`) that cleanly executes the data synchronization pipeline (`python3 run_report_pipeline.py`), verifies SQLite WAL database readiness (`maftia_quant.db`), spawns the single Hono v4 + Bun API Gateway (`0.0.0.0:8765`), starts the Vite React dev server (`:5173`), and executes the Playwright test runner.
- **Strict Single API Gateway Routing**: Ensure all cross-system data queries and live Playwright browser sessions route exclusively through `http://127.0.0.1:8765` without spinning up any ad-hoc temporary servers or non-standard ports (`:3000`, `:8000`, etc.).
- **100% Visual & Runtime Error Assertion**: Verify all 5 core UI views (Master Executive Dashboard `/`, Valuation Studio `/valuation`, LTTD Lab `/lttd`, MTTD Console `/mttd`, and Ichimoku Terminal `/ichimoku`) load and render without any browser `console.error` logs, `pageerror` exceptions, or failed HTTP responses (`status >= 400`).
- **Live 85px Y-Axis & Crosshair DOM Assertion**: Inspect the actual rendered DOM canvases and containers of Lightweight Charts v5.2 across all subplots, verifying that every right Y-axis width is locked precisely to `85px` and that dispatching `mousemove` events coordinates vertical crosshairs precisely across panes.
- **Zero-NaN Telemetry Assertion**: Query table cells, indicator badges, and chart series data to assert that all domain metrics (`MasterOHLCV`, `ValuationComposite`, `LTTDRegime`, `MTTDIntegratedOscillator`, `IchimokuDenoisedOscillator`) display numerical/categorical values without `NaN`, `null`, `undefined`, or empty fallbacks.

**Non-Goals:**
- Altering any quantitative theory or mathematical formulas within the 4 underlying quantitative pillars.
- Re-introducing or interacting with the deprecated `quant-technical-indicator-bank` project (`05. Indicator Bank`).

## Decisions

### Decision 1: Python Orchestrator (`run_e2e_suite.py`) vs Pure Shell Script
- **Rationale**: Python 3.11+ is our core data pipeline runtime and provides cross-platform process management (`subprocess.Popen`), health-check polling (`urllib.request`), and automatic port/WAL connection cleanup (`atexit` / `try-finally`). A Python script ensures that if a Playwright run fails or exits early, both background server processes (Bun API Gateway on `:8765` and Vite Dev Server on `:5173`) and any open SQLite WAL handles are gracefully terminated.
- **Alternatives Considered**: Using a Bash `trap` script or `concurrently` / `start-server-and-test` npm packages. Python was chosen because it natively integrates with `run_report_pipeline.py` execution and database verification prior to launching servers.

### Decision 2: Playwright Live DOM & Console Error Interception (`web/tests/e2e-terminal.spec.ts`)
- **Rationale**: Playwright allows attaching listeners directly to `page.on('console', msg => ...)` and `page.on('pageerror', err => ...)`. By attaching a global error catcher in `test.beforeEach`, we guarantee that any React rendering exception, unhandled promise rejection, or chart canvas initialization crash instantly fails the test with detailed trace output.
- **Alternatives Considered**: Relying solely on visual screenshot diffing (`expect(page).toHaveScreenshot()`). Screenshot diffing is brittle against live dynamic financial data and timestamp changes; explicit DOM and runtime error interception provides deterministic, causal verification.

### Decision 3: Single API Gateway Verification (`0.0.0.0:8765`)
- **Rationale**: In strict compliance with AGENTS.md and our architecture boundaries, the test harness binds the Bun API gateway to `0.0.0.0:8765` and configures Playwright (`web/playwright.config.ts`) to point `baseURL` to `http://localhost:5173` while the frontend connects to `http://127.0.0.1:8765/api/v1/...`. No mock servers or alternative ports are permitted.

## Risks / Trade-offs

- **Risk: Port Collision on `:8765` or `:5173` during automated runs** → *Mitigation*: `run_e2e_suite.py` checks socket availability before starting servers and kills orphaned processes listening on ports `:8765` and `:5173` if necessary before starting new instances.
- **Risk: SQLite WAL Lock Contention when running pipeline and backend simultaneously** → *Mitigation*: The orchestrator runs `python3 run_report_pipeline.py` synchronously to completion, verifying clean connection closure (`atexit` and WAL checkpoint), *before* launching the Bun API gateway process.
- **Risk: Lightweight Charts Canvas Asynchronous Rendering Timing** → *Mitigation*: Playwright tests use `await page.waitForSelector('.tv-lightweight-charts', { state: 'visible' })` and `await page.waitForTimeout(500)` to ensure WebGL/Canvas rendering loops settle before measuring DOM coordinates or checking `minimumWidth: 85` container styles.

## Migration Plan

1. Create `run_e2e_suite.py` in `/home/ubuntu/projects/quant.maftia.tech/`.
2. Add `web/tests/e2e-terminal.spec.ts` containing comprehensive live tests covering the Master Executive Dashboard (`/`) and all 4 Quantitative Studios (`/valuation`, `/lttd`, `/mttd`, `/ichimoku`).
3. Update `web/playwright.config.ts` to ensure clean test reporting, automatic trace capture on failure, and compatibility with the orchestration runner.

## Open Questions

- None. The architecture cleanly separates pre-test pipeline execution, single API gateway binding, and live Playwright DOM verification.
