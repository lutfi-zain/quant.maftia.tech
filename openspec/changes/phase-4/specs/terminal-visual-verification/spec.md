## ADDED Requirements

### Requirement: Playwright 85px Y-Axis Alignment Verification
The system SHALL include an automated Playwright test suite (`web/tests/chart-sync.spec.ts`) that launches the terminal UI and verifies that every chart subplot explicitly configures `rightPriceScale: { minimumWidth: 85 }` and aligns vertically without horizontal drift.

#### Scenario: Subplot container width DOM check
- **WHEN** the Playwright test navigates to the Master Executive Dashboard or any of the 4 quantitative studios
- **THEN** it MUST inspect the Lightweight Charts DOM layout containers and verify that the right Y-axis scale canvas/container width equals `85px` across all vertically stacked subplots (`Price OHLC`, `Valuation`, `LTTD`, `MTTD`)

### Requirement: Playwright Crosshair Synchronization Assertion
The Playwright test harness SHALL simulate mouse hover events on the primary price chart container and assert that vertical crosshairs on all sibling subplots appear at the exact same horizontal client X coordinate.

#### Scenario: Crosshair coordinate verification
- **WHEN** Playwright dispatches a `mousemove` event at horizontal position $X = 350\text{px}$ on Subplot 1 (`MasterOHLCV` price chart)
- **THEN** it MUST assert that Subplot 2 (`ValuationComposite`), Subplot 3 (`LTTDRegime`), and Subplot 4 (`MTTDIntegratedOscillator`) each position their vertical crosshair line exactly at $X = 350\text{px}$, verifying real-time vertical crosshair synchronization
