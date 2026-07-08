## Why

Phase 4 completes the architectural vision of the Maftia Quant Bitcoin Intelligence Platform by delivering a high-end, institutional-grade single-page application (SPA) financial terminal (`web/`). While Phase 1 established `MasterOHLCV` and SQLite WAL concurrency, Phase 2 unified the 4 mathematical engines (`quant-btc-valuation-system`, `quant-btc-lttd-system`, `quant-btc-mttd-system`, `quant-lttd-ichimoku`) with strict $t-1$ causal verification, and Phase 3 deployed the single Hono v4 + Bun API Gateway on port `:8765`, researchers currently lack a synchronized, low-latency visual interface to inspect cross-system consensus, macro circuit breakers, and component-level signals. Building the Phase 4 Financial Terminal UI (`React 19 + Vite + TypeScript + Lightweight Charts v5.2`) provides an Obsidian HSL dark-themed executive dashboard and 4 specialized deep-dive studios with strict `85px` right Y-axis width locking and real-time bidirectional vertical crosshair synchronization.

## What Changes

- **React 19 + Vite + TypeScript Scaffold**: Create the frontend application inside `/home/ubuntu/projects/quant.maftia.tech/web` with Vite, React 19, TypeScript, and Obsidian HSL design tokens (`#0b0e14` dark background, glassmorphism bento grid cards, custom typography).
- **Master Executive Dashboard & Bento Grid Summary**: Implement real-time bento grid cards displaying current `ValuationComposite` (`[-2.0, +2.0]`), `LTTDRegime` (`BULL`, `BEAR`, `SIDEWAYS` HMM state and `0.0%` exposure override), `MTTDIntegratedOscillator` (`[-1.0, +1.0]`), and `IchimokuDenoisedOscillator` metrics fetched via `/api/v1/analytics/daily` and `/api/v1/system/circuit-breakers`.
- **Multi-Pane Synchronized Charting Engine (`85px` Lock)**: Build `MultiPaneChart` utilizing Lightweight Charts v5.2 with 4 vertically stacked subplots (`Price OHLC + Ichimoku Cloud`, `Valuation Composite`, `LTTD Regime Score + Probabilities`, `MTTD v2 IMO + ER Gate >= 0.20 Overlay`). Strictly mandate `rightPriceScale: { minimumWidth: 85 }` across all containers to eliminate horizontal time-tick drift between price digits (`$63,508.84`) and oscillator values (`-0.45`).
- **Bidirectional Vertical Crosshair Synchronization**: Implement cross-container event subscription ensuring that hovering over any timestamp on any subplot immediately projects a synchronized vertical crosshair line and accurate data tooltips across all accompanying stacked subplots.
- **4 Specialized Deep-Dive Studios**:
  - `Valuation Pillar Studio`: Interactive inspection of the 17-indicator piecewise linear interpolated valuation table and historical bubble/discount thresholds (`>= +1.50`, `<= -1.00`).
  - `LTTD Lab`: Visualization of 3-state Gaussian HMM state probabilities (`BULL`, `BEAR`, `SIDEWAYS`), Log Returns, 20-day Volatility, and PCA/VIF pruning metrics ($>10$).
  - `MTTD Console`: 10 Statistical Families consensus heatmap alongside real-time monitoring of `EfficiencyRatioGate` (`>= 0.20`), `ShannonEntropyGate` (`<= 2.30`), and `ChikouMomentumExit` (`< -0.30`).
  - `Ichimoku Terminal`: Denoised bounded $\tanh$ oscillator (`[-1.0, +1.0]`) chart isolating Ehlers 2-pole SuperSmoother IIR cloud components (`S_TK`, `S_Cloud`, `S_Future`, `S_Chikou`).
- **Real-Time WebSocket State & Crosshair Streaming**: Integrate live WebSocket subscription (`ws://0.0.0.0:8765/ws/live`) inside React context/hooks (`useTerminalWebSocket`) for zero-polling real-time updates and live crosshair coordination.
- **Automated Playwright & Visual Verification Harness**: Implement end-to-end UI verification scripts confirming `85px` Y-axis alignment and crosshair sync without horizontal misalignment across all 4 studios.

## Non-Goals

- No modification to historical quantitative calculations in `run_report_pipeline.py` or underlying mathematical models (`quant-btc-valuation-system`, `quant-btc-lttd-system`, `quant-btc-mttd-system`, `quant-lttd-ichimoku`). All frontend data binding strictly consumes immutable $t-1$ verified backend outputs without lookahead bias (`CausalFilter`).
- No restoration, integration, or reference to the explicitly deprecated and banned `quant-technical-indicator-bank` (`05. Indicator Bank`).
- No ad-hoc temporary backend server creation (`:3000`, `:8080`, etc.). All data and WebSocket streaming strictly connect to the unified Hono v4 + Bun API Gateway (`api.quant.maftia.tech:8765`).

## Capabilities

### New Capabilities
- `terminal-state-and-websocket-sync`: Real-time WebSocket connection manager (`useTerminalWebSocket`) and Obsidian HSL theme/state management for live daily analytics updates (`UnifiedDailyAnalytics`) and circuit breaker status (`CircuitBreakerFilter`).
- `terminal-visual-verification`: Automated Playwright verification harness testing and asserting strict `85px` right Y-axis container width (`minimumWidth: 85`), vertical crosshair synchronization across stacked subplots, and responsive layout integrity across the Master Dashboard and 4 studios.

### Modified Capabilities
- `executive-terminal-and-sandboxes`: Expanding requirements to mandate specific bento grid executive summary cards, multi-pane container orchestration (`MultiPaneChart.tsx`), and exact telemetry requirements across all 4 specialized deep-dive studios (`Valuation Pillar Studio`, `LTTD Lab`, `MTTD Console`, `Ichimoku Terminal`).

## Impact

- **Impacted Systems**: All 4 unified quantitative systems (`quant-btc-valuation-system`, `quant-btc-lttd-system`, `quant-btc-mttd-system`, `quant-lttd-ichimoku`) are visually surfaced and monitored via the frontend terminal.
- **New Frontend Workspace**: Creates `/home/ubuntu/projects/quant.maftia.tech/web` containing `package.json` (React 19, Vite, TypeScript, `lightweight-charts@^5.2.0`, `lucide-react`), `index.html`, `src/`, and Playwright verification tests.
- **Backend API Gateway (`src/api/`)**: Consumed directly by the web application over port `:8765` (`http://0.0.0.0:8765` / `ws://0.0.0.0:8765/ws/live`).
- **Lookahead Bias & Causal Guarantee**: All displayed charts and indicator breakdowns enforce zero lookahead bias by sourcing exclusively from historical $t-1$ database timestamps stored in `UnifiedDailyAnalytics` and `UnifiedComponentSignals`.
