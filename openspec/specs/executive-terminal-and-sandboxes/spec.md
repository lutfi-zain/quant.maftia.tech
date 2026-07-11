# Executive Terminal and Sandboxes

## Purpose
Defines requirements for the responsive React 19 + Vite single-page financial terminal architecture (`/web`), Bento Grid cards, Obsidian HSL styling, 85px right Y-axis width locking across chart containers, real-time vertical crosshair synchronization across subplots, and specialized studio deep-dive telemetry.
## Requirements
### Requirement: React 19 + Vite Financial Terminal Architecture
The frontend web application SHALL be structured as a responsive React 19 single-page application built with Vite and TypeScript inside `/home/ubuntu/projects/quant.maftia.tech/web`, featuring an Obsidian HSL dark-themed Master Executive Dashboard alongside 4 dedicated quantitative studios (`Valuation Pillar Studio`, `LTTD Lab`, `MTTD Console`, and `Ichimoku Terminal`) consuming data strictly via the API Gateway on `:8765`. On desktop viewports (`≥768px`), the terminal SHALL use a fixed 260px left sidebar layout. On mobile viewports (`<768px`), the terminal SHALL dynamically switch to a fixed bottom navigation tab bar and sticky top header without requiring a page reload.

#### Scenario: Studio navigation and data binding
- **WHEN** a user navigates between the Master Executive Dashboard and any of the 4 specialized quantitative studios across desktop or mobile viewports
- **THEN** the active studio MUST fetch real-time and historical analytics directly from `api.quant.maftia.tech:8765` (`UnifiedDailyAnalytics` and `UnifiedComponentSignals`) without lookahead bias ($t-1$ `CausalFilter`)

### Requirement: 85px Right Y-Axis Width Lock on Subplots
Every Lightweight Charts (`v5.2`) price and oscillator subplot container across the Master Executive Dashboard and all 4 studios SHALL explicitly lock its right Y-axis (`priceScale`) width to exactly `85px` (`rightPriceScale: { minimumWidth: 85 }`) when rendering on desktop viewports (`≥768px`). When rendering on mobile viewports (`<768px`), every subplot container SHALL explicitly relax its right Y-axis (`priceScale`) width to exactly `65px` (`rightPriceScale: { minimumWidth: 65 }`) to preserve horizontal plotting area while maintaining cross-subplot time-tick alignment.

#### Scenario: Subplot time-tick alignment check on desktop
- **WHEN** multiple Lightweight Charts (`v5.2`) subplots are rendered vertically on a desktop viewport (`≥768px`)
- **THEN** each subplot MUST enforce `rightPriceScale: { minimumWidth: 85 }` so that horizontal time-ticks align perfectly across all stacked containers regardless of character count differences between large Bitcoin prices (`$63,508.84`) and small oscillator floats (`-0.45`)

#### Scenario: Subplot time-tick alignment check on mobile
- **WHEN** multiple Lightweight Charts (`v5.2`) subplots are rendered vertically on a mobile viewport (`<768px`)
- **THEN** each subplot MUST enforce `rightPriceScale: { minimumWidth: 65 }` across all stacked containers (`MasterOHLCV`, `MTTDIntegratedOscillator`, `ValuationComposite`, `IchimokuDenoisedOscillator`) so vertical alignment remains locked while reclaiming 20px of canvas width for candlestick rendering

### Requirement: Real-Time Vertical Crosshair Synchronization
The frontend terminal SHALL implement bidirectional real-time Vertical Crosshair Synchronization across all vertically stacked Lightweight Charts (`v5.2`) subplots within any active view or studio using `subscribeCrosshairMove` and `setCrosshairPosition`.

#### Scenario: Crosshair dragging across multi-layer indicators
- **WHEN** a user hovers or drags the crosshair over a specific date index on the primary `MasterOHLCV` price chart
- **THEN** all accompanying oscillator and regime subplots (`ValuationComposite`, `LTTDRegime`, `MTTDIntegratedOscillator`, `IchimokuDenoisedOscillator`) MUST simultaneously display their vertical crosshair line and data tooltips at that exact timestamp index without triggering recursive event loop echoes

### Requirement: Bento Grid Executive Summary Cards
The Master Executive Dashboard SHALL display high-contrast bento grid status cards at the top of the interface summarizing the latest consolidated metrics from all 4 systems.

#### Scenario: Real-time bento summary inspection
- **WHEN** the dashboard mounts or receives updated metrics from `/api/v1/analytics/daily` or `/api/v1/system/circuit-breakers`
- **THEN** the cards MUST render:
  1. `ValuationComposite` score (`[-2.0, +2.0]`) with macro bubble/discount status (`>= +1.50` / `<= -1.00`)
  2. `LTTDRegime` classification (`BULL`, `BEAR`, `SIDEWAYS` HMM state and `0.0%` cash exposure override when `SIDEWAYS`)
  3. `MTTDIntegratedOscillator` value (`[-1.0, +1.0]`) alongside its 3 gate indicators (`Efficiency Ratio`, `Shannon Entropy`, `Chikou Momentum`)
  4. `IchimokuDenoisedOscillator` value (`[-1.0, +1.0]`) and Ehlers SuperSmoother cloud state

### Requirement: Specialized Studio Deep-Dive Telemetry

Each of the 4 quantitative studios (`Valuation Pillar Studio`, `LTTD Lab`, `MTTD Console`, `Ichimoku Terminal`) SHALL provide dedicated telemetry views querying `/api/v1/analytics/components` to visualize underlying component metrics.

#### Scenario: Studio-specific component rendering

- **WHEN** a researcher selects a specific studio from the sidebar
- **THEN** that studio MUST render its domain-specific visualization:
  - `Valuation Pillar Studio`: 17-indicator piecewise breakdown matrix and score timeline, PLUS individual metric drill-down with 3-panel chart view (BTC OHLC + Raw Metric + Oscillator), inline threshold editor with save-to-backend, 90-day sparkline mini-charts in each matrix row, and PNG export capability
  - `LTTD Lab`: 3-state Gaussian HMM stacked probability bar chart (`P_Bull`, `P_Bear`, `P_Sideways`), Log Returns, 20-day Volatility, and PCA/VIF pruning verification
  - `MTTD Console`: 10 Statistical Families consensus matrix (`Smoothing`, `Filtering`, `Regression`, `Spectral`, `Fractal`, `GARCH`, `Entropy`, `Chaos`, `Bayesian`, `ML-Hybrid`) and ER/Entropy gate threshold charts
  - `Ichimoku Terminal`: Denoised $\tanh$ oscillator chart alongside raw and Ehlers 2-pole SuperSmoother IIR cloud curves (`S_TK`, `S_Cloud`, `S_Future`, `S_Chikou`)

### Requirement: Valuation Studio Navigation State

The Valuation Studio SHALL maintain navigation state to switch between the main composite view and individual metric detail views.

#### Scenario: Switch between composite and detail view

- **WHEN** a user clicks an indicator row in the component matrix
- **THEN** the studio MUST transition to the metric detail view, storing the selected metric name in component state, and restore the composite view when the user closes the detail view

#### Scenario: Browser back/forward navigation

- **WHEN** a user navigates to a metric detail view and then presses the browser back button
- **THEN** the studio MUST restore the main composite view (note: this is a stretch goal and may be deferred to a future iteration)

### Requirement: Valuation Studio Header with Export Control

The Valuation Studio header bar SHALL include a "SAVE PNG" button alongside the existing LOG/LIN toggle and maximize controls.

#### Scenario: Export button visibility

- **WHEN** the Valuation Studio is rendered with chart data
- **THEN** the header control bar MUST display the "SAVE PNG" button in the same visual style as the existing LOG/LIN toggle buttons

#### Scenario: Export button in detail view

- **WHEN** the 3-panel metric detail view is active
- **THEN** the "SAVE PNG" button MUST export the 3-panel chart (not the composite chart)

### Requirement: Mobile Chart Subplot Heights
When rendering on mobile viewports (`<768px`), stacked multi-pane chart subplots across all studios and the executive dashboard SHALL adjust their vertical height allocations to fit within smaller phone screens without excessive vertical scrolling.

#### Scenario: Subplot height allocation on phone viewports
- **WHEN** multi-pane charts (`MultiPaneChart.tsx`, `LttdLab.tsx`, `MttdConsole.tsx`, `IchimokuTerminal.tsx`) mount on a mobile viewport (`<768px`)
- **THEN** the primary candlestick price subplot (`MasterOHLCV`) MUST render at `160px` height (`height: 160`), and all accompanying secondary oscillator/regime subplots MUST render at `120px` height (`height: 120`), down from their desktop allocations (`220px`/`160-180px`)

### Requirement: Responsive Stat Card Grids
All diagnostic and status card grids inside `LttdLab.tsx` and `MttdConsole.tsx` (`PCA & VIF Diagnostics Grid`, `Consensus Gate Status Grid`) SHALL use responsive auto-fitting grid templates rather than fixed 3-column splits.

#### Scenario: Diagnostic card grid reflow on mobile
- **WHEN** diagnostic grids render on a mobile viewport (`<768px`)
- **THEN** the grid template MUST use `repeat(auto-fit, minmax(140px, 1fr))` with `gap: 12px` so stat cards stack cleanly into 2 columns on phones instead of overflowing a fixed `repeat(3, 1fr)` layout

