# Executive Terminal and Sandboxes (Delta Spec)

## MODIFIED Requirements

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

## ADDED Requirements

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
