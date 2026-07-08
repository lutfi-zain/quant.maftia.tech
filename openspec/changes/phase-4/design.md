## Context

The Maftia Quant Bitcoin Intelligence Platform has successfully consolidated 4 quantitative engines (`quant-btc-valuation-system`, `quant-btc-lttd-system`, `quant-btc-mttd-system`, `quant-lttd-ichimoku`) in Phase 2 and exposed their consolidated outputs (`UnifiedDailyAnalytics` and `UnifiedComponentSignals`) via a high-performance Hono v4 + Bun API Gateway running on port `:8765` in Phase 3. However, without a dedicated visual frontend, quantitative researchers must query REST endpoints or inspect SQLite database tables directly. 

To bridge this gap, Phase 4 introduces the React 19 + Vite + TypeScript single-page application (SPA) under `/home/ubuntu/projects/quant.maftia.tech/web`. The UI requires institutional-grade responsiveness, Obsidian HSL high-contrast dark mode aesthetics, and zero-lookahead ($t-1$) data visualization across a Master Executive Dashboard and 4 specialized studios (`Valuation Studio`, `LTTD Lab`, `MTTD Console`, and `Ichimoku Terminal`). Specifically, multi-pane charting (`Lightweight Charts v5.2`) must overcome the notorious horizontal time-axis drift caused by differing character widths on Y-axis scales between Bitcoin prices (`$63,508.84`) and bounded oscillators (`-0.45`), requiring a strict `85px` right Y-axis width lock across all subplots alongside real-time vertical crosshair synchronization.

## Goals / Non-Goals

**Goals:**
- Scaffolding a production-ready Vite + React 19 + TypeScript SPA inside `/home/ubuntu/projects/quant.maftia.tech/web` configured with Lucide React icons and Obsidian HSL design system tokens (`#0b0e14` surface, `#111622` cards).
- Building the Master Executive Dashboard featuring bento grid status cards for real-time `ValuationComposite` (`[-2.0, +2.0]`), `LTTDRegime` (`BULL`, `BEAR`, `SIDEWAYS`), `MTTDIntegratedOscillator` (`[-1.0, +1.0]`), and `IchimokuDenoisedOscillator`.
- Implementing `MultiPaneChart.tsx` utilizing `lightweight-charts@^5.2.0` with 4 stacked subplots (`Price OHLC + Ichimoku Cloud`, `Valuation Composite`, `LTTD Regime Score + HMM Probabilities`, and `MTTD v2 IMO + Kaufman ER Gate overlay`).
- Enforcing strict `85px` right Y-axis container width (`rightPriceScale: { minimumWidth: 85 }`) on every chart container across the dashboard and all 4 studios.
- Implementing bidirectional real-time Vertical Crosshair Synchronization where hovering or dragging on one subplot instantly positions the vertical crosshair line and updates data tooltips across all accompanying subplots.
- Developing 4 specialized Deep-Dive Studios (`Valuation Pillar Studio`, `LTTD Lab`, `MTTD Console`, `Ichimoku Terminal`) querying `/api/v1/analytics/daily`, `/api/v1/system/circuit-breakers`, and `/api/v1/analytics/components`.
- Integrating a robust WebSocket hook (`useTerminalWebSocket`) connecting to `ws://0.0.0.0:8765/ws/live` to maintain live state synchronization without polling.
- Creating an automated Playwright visual verification suite (`web/tests/chart-sync.spec.ts`) asserting strict `85px` Y-axis alignment and crosshair sync across the 4 studios.

**Non-Goals:**
- No modification of core backend calculation logic or `run_report_pipeline.py` orchestration.
- No ad-hoc temporary server setups (`:3000`, `:8080`, etc.). All frontend requests route strictly to `api.quant.maftia.tech:8765` (`http://0.0.0.0:8765`).
- No integration, restoration, or reference to the deprecated `quant-technical-indicator-bank` (`05. Indicator Bank`).

## Decisions

### Decision 1: Frontend Build Stack (`Vite + React 19 + TypeScript + Obsidian HSL Tokens`)
- **Rationale**: Vite provides sub-second HMR and native ESM bundling, ideal for institutional financial terminals. React 19 ensures concurrent rendering stability. Obsidian HSL tokens implemented in vanilla CSS/CSS variables (`index.css`) eliminate third-party CSS framework bloating while guaranteeing high-end glassmorphic bento grids and ultra-crisp dark terminal aesthetics.
- **Alternatives Considered**: Next.js (rejected because Server-Side Rendering adds unnecessary Node.js overhead for a local/internal quantitative research terminal whose backend runs independently on Hono + Bun `:8765`) and Tailwind CSS (rejected in favor of explicit, deterministic Obsidian HSL design system tokens per architectural guidelines).

### Decision 2: Multi-Pane Charting Orchestration (`85px Y-Axis Lock & Vertical Sync`)
- **Rationale**: TradingView Lightweight Charts v5.2 (`createChart`) renders each container canvas independently. When stacked vertically, if Subplot 1 displays `$63,508.84` (approx. 70px wide) and Subplot 2 displays `-0.45` (approx. 35px wide), the right Y-axes align differently, causing the horizontal $X$-axis timestamps (`date`) to misalign horizontally across the screen. Mandating `chart.timeScale().applyOptions(...)` alongside `rightPriceScale: { minimumWidth: 85 }` on every instance guarantees pixel-perfect right margin locking across all stacked subplots.
- **Crosshair Sync Mechanism**: Each subplot subscribes to `chart.subscribeCrosshairMove(param => ...)`. When triggered by mouse hover, the event handler broadcasts the exact `param.time` index to all sibling `chart` instances via `chart.setCrosshairPosition(0, param.time, chart.timeScale())` while suppressing recursive echo loops via an `isSyncing` mutex flag.
- **Alternatives Considered**: Chart.js or Recharts (rejected due to severe SVG DOM performance lag when rendering 2,000+ daily OHLCV and multi-oscillator time-series data points).

### Decision 3: Single API Gateway Binding & WebSocket State Architecture
- **Rationale**: The web terminal configures a global API client base URL `http://0.0.0.0:8765` (or relative path if proxied during production deployment) and WebSocket connection to `ws://0.0.0.0:8765/ws/live`. `useTerminalWebSocket` automatically reconnects using exponential backoff up to 10s and dispatches incoming messages (`analytics_update`, `circuit_breaker_trip`) directly to React Context/state, ensuring zero polling loops.
- **Alternatives Considered**: Polling `/api/v1/analytics/daily` every 5 seconds (rejected due to unnecessary SQLite WAL reader lock pressure and high network chatter).

### Decision 4: Studio Deep-Dive Architecture (`4 Dedicated Studio Views`)
- **Rationale**: Each system requires specialized visual inspections:
  - **Valuation Pillar Studio**: Displays the 17-indicator breakdown grid and bubble/discount boundary alerts (`Score >= +1.50` vs `<= -1.00`).
  - **LTTD Lab**: Displays the 3-State Gaussian HMM stacked probability bar chart (`P_Bull`, `P_Bear`, `P_Sideways`) and clearly highlights the `SIDEWAYS` override forcing `0.0` exposure.
  - **MTTD Console**: Displays the 10 Statistical Families consensus matrix (`Smoothing`, `Filtering`, `Regression`, `Spectral`, `Fractal`, `GARCH`, `Entropy`, `Chaos`, `Bayesian`, `ML-Hybrid`) and plots the three interlocking gates (`EfficiencyRatio >= 0.20`, `ShannonEntropy <= 2.30`, `ChikouMomentum < -0.30`).
  - **Ichimoku Terminal**: Displays `IchimokuDenoisedOscillator` `[-1.0, +1.0]` alongside raw and Ehlers 2-pole SuperSmoother IIR cloud curves (`S_TK`, `S_Cloud`, `S_Future`, `S_Chikou`).

## Risks / Trade-offs

- **[Risk: Crosshair Event Infinite Loop / Performance Jitter]** -> When 4 subplots simultaneously trigger crosshair updates, an unthrottled loop can freeze the browser render thread.
  - **Mitigation**: Implement an `isSyncingRef` boolean guard inside `MultiPaneChart.tsx` and throttle crosshair propagation using `requestAnimationFrame`.
- **[Risk: Y-Axis Width Overflow for Extreme Prices ($100k+)]** -> If Bitcoin price exceeds `$100,000.00`, standard character widths might exceed 85px.
  - **Mitigation**: Setting `minimumWidth: 85` ensures that any smaller character count (like oscillators `-1.0`) expands exactly to `85px` minimum, while price scales remain locked at >=85px. We configure price formatting (`$63.5K` or `$102.4K` in summary tooltips) and test `$100k+` price strings in our Playwright visual validation harness.
- **[Risk: API Gateway CORS or Hostname Binding Errors]** -> If the API gateway is only bound to `127.0.0.1`, external or containerized browser clients cannot connect.
  - **Mitigation**: Strictly verify and enforce that backend and frontend services bind to `0.0.0.0` (`hostname: '0.0.0.0'`), routing all REST/WebSocket requests directly to port `:8765`.

## Migration Plan

1. **Scaffold Web Application**: Initialize `/home/ubuntu/projects/quant.maftia.tech/web` with Vite (`bun create vite web --template react-ts` or direct package layout).
2. **Design Tokens & Components**: Populate `src/index.css` with Obsidian HSL design variables (`--bg-primary: #0b0e14`, `--card-surface: #111622`, `--accent-cyan: #00f0ff`, `--accent-gold: #ffb800`).
3. **Core Dashboard & Multi-Pane Chart Engine**: Implement `ExecutiveDashboard.tsx` and `MultiPaneChart.tsx` enforcing the `85px` lock (`rightPriceScale: { minimumWidth: 85 }`) and crosshair sync.
4. **4 Deep-Dive Studios**: Implement `ValuationStudio.tsx`, `LttdLab.tsx`, `MttdConsole.tsx`, and `IchimokuTerminal.tsx`.
5. **WebSocket & API Integration**: Connect all views to `http://0.0.0.0:8765` and `ws://0.0.0.0:8765/ws/live`.
6. **Playwright Verification**: Add and execute automated Playwright checks (`web/tests/chart-sync.spec.ts`) asserting `85px` Y-axis alignment across all subplots.

## Open Questions

- None. All backend endpoints (`/api/v1/analytics/daily`, `/api/v1/system/circuit-breakers`, `/api/v1/analytics/components`) and WebSocket broadcasts (`/ws/live`) are fully established and operational in Phase 3.
