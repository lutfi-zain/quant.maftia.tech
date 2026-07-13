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

Each of the 4 quantitative studios (`Valuation Pillar Studio`, `LTTD Lab`, `MTTD Console`, `Ichimoku Terminal`) SHALL provide dedicated telemetry views querying `/api/v1/analytics/components` and `/api/v1/analytics/daily` to visualize underlying component metrics, exact performance metric summary cards (`Win Rate`, `Profit Factor`, `Total Trades`, `Sharpe Ratio`, `Max Drawdown`, `Ann Return`, `Ann Volatility`) verified $1:1$ against canonical Python engines, complete trade execution logs (`trades` table), exact strategy vs market equity curves (`cumStrat` & `cumMarket`), and vertically synchronized multi-pane subplots with locked $85\text{px}$ right Y-axis widths.

#### Scenario: Studio-specific component rendering

- **WHEN** a researcher selects a specific studio from the sidebar
- **THEN** that studio MUST render its domain-specific visualization, $1:1$ verified performance cards, trade execution history table, equity curves, and strictly synchronized $85\text{px}$-locked chart subplots:
  - `Valuation Pillar Studio`: 17-indicator piecewise breakdown matrix and score timeline, PLUS individual metric drill-down with 3-panel chart view (BTC OHLC + Raw Metric + Oscillator), inline threshold editor with save-to-backend, 90-day sparkline mini-charts in each matrix row, $1:1$ verified valuation backtest metrics, exact trade execution log, and PNG export capability
  - `LTTD Lab`: 3-state Gaussian HMM stacked probability bar chart (`P_Bull`, `P_Bear`, `P_Sideways`), Log Returns, 20-day Volatility, PCA/VIF pruning verification, $1:1$ verified LTTD regime strategy performance cards, exact trade execution history log (`BULL -> SIDEWAYS/BEAR` transitions), and exact equity curve comparison
  - `MTTD Console`: 10 Statistical Families consensus matrix (`Smoothing`, `Filtering`, `Regression`, `Spectral`, `Fractal`, `GARCH`, `Entropy`, `Chaos`, `Bayesian`, `ML-Hybrid`), ER/Entropy gate threshold charts, $1:1$ verified multi-principle consensus strategy performance cards, exact trade execution history log (`Entry/Exit` driven by gates & Chikou momentum), and exact equity curve comparison
  - `Ichimoku Terminal`: Denoised $\tanh$ oscillator chart alongside raw and Ehlers 2-pole SuperSmoother IIR cloud curves (`S_TK`, `S_Cloud`, `S_Future`, `S_Chikou`), $1:1$ verified performance cards ($22/22$ assertions), exact trade execution log (`13 trades`), and exact reference equity curves (`ichi_cum_strat` vs `ichi_cum_market`)

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

### Requirement: Executive Dashboard Bento Grid

The `BentoSummary` grid SHALL use a gap of `10px` between cards (reduced from `20px`). Each bento card SHALL use `12px` internal padding (reduced from `20px`). Primary metric values SHALL use `26px` font-size (reduced from `32px`). Card bottom separator margin SHALL be `10px` top / `8px` top padding (reduced from `16px` / `12px`).

#### Scenario: Bento grid renders compact
- **WHEN** the `BentoSummary` component renders on desktop
- **THEN** the grid `gap` SHALL be `10px`
- **THEN** each card's padding SHALL be `12px`
- **THEN** the primary metric font-size SHALL be `26px`

### Requirement: Sidebar Navigation Density

The sidebar nav items SHALL use `7px 10px` padding (reduced from `10px 12px`). Nav item gap SHALL be `2px` (reduced from `4px`). The brand header section SHALL use `14px` padding (reduced from `20px`). Sidebar width SHALL remain `260px`.

#### Scenario: Sidebar nav renders compact
- **WHEN** the `Sidebar` component renders on desktop
- **THEN** each nav button's padding SHALL be `7px 10px`
- **THEN** the gap between nav items SHALL be `2px`
- **THEN** the brand header padding SHALL be `14px`

### Requirement: Desktop Page Header Density

The desktop page header SHALL use `8px` bottom padding (reduced from `16px`). The page title font-size SHALL remain `22px`. The subtitle line SHALL remain `12px`.

#### Scenario: Page header renders compact
- **WHEN** the `AppLayout` desktop header renders
- **THEN** its `paddingBottom` SHALL be `8px`

### Requirement: Main Content Area Spacing

The main content area SHALL use `16px 24px` padding on desktop (reduced from `24px 32px`). The gap between content sections SHALL be `16px` (reduced from `24px`).

#### Scenario: Main content renders with tight padding
- **WHEN** the `<main>` element renders on desktop
- **THEN** its padding SHALL be `16px 24px`
- **THEN** the gap between child sections SHALL be `16px`

