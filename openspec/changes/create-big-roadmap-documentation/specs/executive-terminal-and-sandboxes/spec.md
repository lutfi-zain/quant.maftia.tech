## ADDED Requirements

### Requirement: React 19 + Vite Financial Terminal Architecture
The frontend web application SHALL be structured as a responsive React 19 single-page application built with Vite and TypeScript, featuring a Master Executive Dashboard along with 4 dedicated quantitative studios (`Valuation Studio`, `LTTD Lab`, `MTTD Console`, and `Ichimoku Terminal`).

#### Scenario: Studio navigation and data binding
- **WHEN** a user navigates between the Master Executive Dashboard and any of the 4 specialized quantitative studios
- **THEN** the active studio MUST fetch real-time and historical analytics directly from `api.quant.maftia.tech:8765` (`UnifiedDailyAnalytics` and `UnifiedComponentSignals`)

### Requirement: 85px Right Y-Axis Width Lock on Subplots
Every Lightweight Charts (`v5.2`) price and oscillator subplot container across the Master Executive Dashboard and all 4 studios SHALL explicitly lock its right Y-axis (`priceScale`) width to exactly `85px`.

#### Scenario: Subplot time-tick alignment check
- **WHEN** multiple Lightweight Charts (`v5.2`) subplots are rendered vertically (e.g., `MasterOHLCV` price vs `MTTDIntegratedOscillator` `[-1.0, +1.0]` vs `ValuationComposite` `[-2.0, +2.0]`)
- **THEN** each subplot MUST enforce `rightPriceScale: { minimumWidth: 85 }` so that horizontal time-ticks align perfectly across all stacked containers regardless of character count differences

### Requirement: Real-Time Vertical Crosshair Synchronization
The frontend terminal SHALL implement bidirectional real-time Vertical Crosshair Synchronization across all vertically stacked Lightweight Charts (`v5.2`) subplots within any active view or studio.

#### Scenario: Crosshair dragging across multi-layer indicators
- **WHEN** a user hovers or drags the crosshair over a specific date index on the primary `MasterOHLCV` price chart
- **THEN** all accompanying oscillator and regime subplots (`ValuationComposite`, `LTTDRegime`, `MTTDIntegratedOscillator`, `IchimokuDenoisedOscillator`) MUST simultaneously display their vertical crosshair line and data tooltips at that exact timestamp index
