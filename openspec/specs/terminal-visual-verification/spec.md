# Terminal Visual Verification

## Purpose
Defines requirements for automated Playwright verification testing (`/web/tests/chart-sync.spec.ts` and `/web/tests/e2e-terminal.spec.ts`), checking `rightPriceScale: { minimumWidth: 85 }` enforcement on all chart subplots, verifying bidirectional vertical crosshair alignment across multi-pane layouts, and ensuring visual completeness and zero runtime errors.

## Requirements

### Requirement: Playwright 85px Y-Axis Alignment Verification
The system SHALL include an automated Playwright test suite (`web/tests/e2e-terminal.spec.ts` and `web/tests/chart-sync.spec.ts`) that launches a live browser against the running application (`http://localhost:5173`) connected to the API Gateway (`http://127.0.0.1:8765`), and verifies that every chart subplot explicitly configures and renders with `rightPriceScale: { minimumWidth: 85 }` across all views without horizontal drift.

#### Scenario: Subplot container width DOM check
- **WHEN** the Playwright test navigates to the Master Executive Dashboard (`/`) or any of the 4 quantitative studios (`/valuation`, `/lttd`, `/mttd`, `/ichimoku`)
- **THEN** it MUST inspect the live rendered Lightweight Charts DOM containers and canvas elements (`.tv-lightweight-charts`) after chart rendering completes, verifying that the right Y-axis scale canvas/container width equals exactly `85px` across all vertically stacked subplots (`Price OHLC`, `Valuation`, `LTTD`, `MTTD`)

### Requirement: Playwright Crosshair Synchronization Assertion
The Playwright test harness SHALL simulate live mouse hover and movement events on the primary `MasterOHLCV` price chart container inside a real browser and assert that vertical crosshairs on all sibling subplots appear at the exact same horizontal client X coordinate.

#### Scenario: Crosshair coordinate verification
- **WHEN** Playwright dispatches a `mousemove` event at horizontal position $X = 350\text{px}$ on Subplot 1 (`MasterOHLCV` price chart container) inside the live browser session
- **THEN** it MUST assert that Subplot 2 (`ValuationComposite`), Subplot 3 (`LTTDRegime`), and Subplot 4 (`MTTDIntegratedOscillator` or `IchimokuDenoisedOscillator`) each position their vertical crosshair line exactly at $X = 350\text{px}$, verifying real-time vertical crosshair synchronization without pixel drift

### Requirement: Zero Runtime Browser Console and Page Errors
The Playwright verification harness SHALL attach event listeners to `page.on('console')` and `page.on('pageerror')` across all test execution flows, failing any test immediately upon detecting unhandled runtime exceptions or errors.

#### Scenario: Navigation across all quantitative views without JavaScript exceptions
- **WHEN** the Playwright test navigates through Master Executive Dashboard (`/`), Valuation Studio (`/valuation`), LTTD Lab (`/lttd`), MTTD Console (`/mttd`), and Ichimoku Terminal (`/ichimoku`)
- **THEN** the browser console SHALL NOT emit any errors of type `error` (such as React rendering crashes, uncaught promise rejections, network fetch failures, or Lightweight Charts initialization exceptions)

### Requirement: Visual Completeness and Zero-NaN Telemetry Display
The Playwright test suite SHALL verify that when the application loads live telemetry from `UnifiedDailyAnalytics` (`unified_daily_analytics`), all domain metric badges, table cells, and chart series render valid numerical and categorical values.

#### Scenario: Verification of valid indicator values
- **WHEN** data for `MasterOHLCV`, `ValuationComposite`, `LTTDRegime`, `MTTDIntegratedOscillator`, and `IchimokuDenoisedOscillator` is rendered on any studio view or summary table
- **THEN** the DOM elements SHALL NOT display `NaN`, `null`, `undefined`, `[object Object]`, or empty placeholders, and chart series SHALL render visible data points corresponding to historical timestamps strictly up to current date $t-1$ or `today` (zero lookahead bias)
