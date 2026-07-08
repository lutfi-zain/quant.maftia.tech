## MODIFIED Requirements

### Requirement: React 19 + Vite Financial Terminal Architecture
The frontend web application SHALL be structured as a responsive React 19 single-page application built with Vite and TypeScript inside `/home/ubuntu/projects/quant.maftia.tech/web`, featuring an Obsidian HSL dark-themed Master Executive Dashboard alongside 4 dedicated quantitative studios (`Valuation Pillar Studio`, `LTTD Lab`, `MTTD Console`, and `Ichimoku Terminal`) consuming data strictly via the API Gateway on `:8765`.

#### Scenario: Studio navigation and data binding
- **WHEN** a user navigates between the Master Executive Dashboard and any of the 4 specialized quantitative studios
- **THEN** the active studio MUST fetch real-time and historical analytics directly from `api.quant.maftia.tech:8765` (`UnifiedDailyAnalytics` and `UnifiedComponentSignals`) without lookahead bias ($t-1$ `CausalFilter`)

### Requirement: 85px Right Y-Axis Width Lock on Subplots
Every Lightweight Charts (`v5.2`) price and oscillator subplot container across the Master Executive Dashboard and all 4 studios SHALL explicitly lock its right Y-axis (`priceScale`) width to exactly `85px` (`rightPriceScale: { minimumWidth: 85 }`).

#### Scenario: Subplot time-tick alignment check
- **WHEN** multiple Lightweight Charts (`v5.2`) subplots are rendered vertically (e.g., `MasterOHLCV` price vs `MTTDIntegratedOscillator` `[-1.0, +1.0]` vs `ValuationComposite` `[-2.0, +2.0]`)
- **THEN** each subplot MUST enforce `rightPriceScale: { minimumWidth: 85 }` so that horizontal time-ticks align perfectly across all stacked containers regardless of character count differences between large Bitcoin prices (`$63,508.84`) and small oscillator floats (`-0.45`)

### Requirement: Real-Time Vertical Crosshair Synchronization
The frontend terminal SHALL implement bidirectional real-time Vertical Crosshair Synchronization across all vertically stacked Lightweight Charts (`v5.2`) subplots within any active view or studio using `subscribeCrosshairMove` and `setCrosshairPosition`.

#### Scenario: Crosshair dragging across multi-layer indicators
- **WHEN** a user hovers or drags the crosshair over a specific date index on the primary `MasterOHLCV` price chart
- **THEN** all accompanying oscillator and regime subplots (`ValuationComposite`, `LTTDRegime`, `MTTDIntegratedOscillator`, `IchimokuDenoisedOscillator`) MUST simultaneously display their vertical crosshair line and data tooltips at that exact timestamp index without triggering recursive event loop echoes

## ADDED Requirements

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
  - `Valuation Pillar Studio`: 17-indicator piecewise breakdown matrix and score timeline
  - `LTTD Lab`: 3-state Gaussian HMM stacked probability bar chart (`P_Bull`, `P_Bear`, `P_Sideways`), Log Returns, 20-day Volatility, and PCA/VIF pruning verification
  - `MTTD Console`: 10 Statistical Families consensus matrix (`Smoothing`, `Filtering`, `Regression`, `Spectral`, `Fractal`, `GARCH`, `Entropy`, `Chaos`, `Bayesian`, `ML-Hybrid`) and ER/Entropy gate threshold charts
  - `Ichimoku Terminal`: Denoised $\tanh$ oscillator chart alongside raw and Ehlers 2-pole SuperSmoother IIR cloud curves (`S_TK`, `S_Cloud`, `S_Future`, `S_Chikou`)
