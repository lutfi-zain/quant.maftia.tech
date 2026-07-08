## 1. Setup & Scaffolding

- [x] 1.1 Scaffold the React 19 + Vite + TypeScript single-page application inside `/home/ubuntu/projects/quant.maftia.tech/web` with `package.json` dependencies (`lightweight-charts@^5.2.0`, `lucide-react`) and configure Vite server proxy/base settings pointing to API Gateway port `:8765` (`http://0.0.0.0:8765`).
- [x] 1.2 Implement the Obsidian HSL Design System tokens inside `web/src/index.css` (`--bg-primary: #0b0e14`, `--surface-card: #111622`, `--accent-cyan: #00f0ff`, `--accent-gold: #ffb800`, `--status-danger: #ff2a5f`) and configure global typography and glassmorphic card utility classes.
- [x] 1.3 Create the main layout and navigation sidebar structure (`web/src/components/layout/AppLayout.tsx` and `Sidebar.tsx`) supporting seamless routing between the Master Executive Dashboard and the 4 specialized studios (`Valuation Studio`, `LTTD Lab`, `MTTD Console`, `Ichimoku Terminal`).

## 2. Real-Time WebSocket & API Client State Management

- [x] 2.1 Implement the typed API fetch wrapper (`web/src/api/client.ts`) for querying `/api/v1/analytics/daily`, `/api/v1/system/circuit-breakers`, `/api/v1/analytics/components`, and `/api/v1/health` with strict $t-1$ `CausalFilter` verification.
- [x] 2.2 Build the custom WebSocket hook (`web/src/hooks/useTerminalWebSocket.ts`) connecting to `ws://0.0.0.0:8765/ws/live` with exponential backoff (up to 10s delay) and state dispatching for zero-polling `analytics_update` and `circuit_breaker_trip` broadcasts.
- [x] 2.3 Implement the top-level React state provider/context (`web/src/context/TerminalContext.tsx`) sharing real-time daily analytics and circuit breaker state across all child components and studio views.

## 3. Master Executive Dashboard & Bento Grid Cards

- [x] 3.1 Implement the Bento Grid Executive Summary card component (`web/src/components/dashboard/BentoSummary.tsx`) displaying current `ValuationComposite` score (`[-2.0, +2.0]`) and overvalued/discount badge (`>= +1.50` vs `<= -1.00`).
- [x] 3.2 Build the `LTTDRegime` bento card highlighting 3-State Gaussian HMM state (`BULL`, `BEAR`, `SIDEWAYS`) and prominent visual alert when `SIDEWAYS` override forces `0.0%` cash exposure on mid-term systems.
- [x] 3.3 Build the `MTTDIntegratedOscillator` and `IchimokuDenoisedOscillator` bento cards displaying `[-1.0, +1.0]` consensus scores and status pills for the 3 MTTD gates (`ER Gate >= 0.20`, `Entropy Gate <= 2.30`, `Chikou Momentum < -0.30`) and Ichimoku SuperSmoother cloud state.

## 4. Multi-Pane Synchronized Charting Engine (`85px` Y-Axis Lock)

- [x] 4.1 Implement `web/src/components/charts/MultiPaneChart.tsx` using `createChart` (`Lightweight Charts v5.2`) rendering 4 vertically stacked subplots (`MasterOHLCV` Price + Ichimoku Cloud + Buy/Sell markers, `ValuationComposite` oscillator, `LTTDRegime` score + probability fills, and `MTTDIntegratedOscillator` + Kaufman ER Gate overlay).
- [x] 4.2 Enforce strict `85px` right Y-axis container width (`rightPriceScale: { minimumWidth: 85 }`) across every chart instance within `MultiPaneChart.tsx` so horizontal time-ticks align perfectly across all stacked containers regardless of digit length differences (`$63,508.84` vs `-0.45`).
- [x] 4.3 Implement bidirectional real-time Vertical Crosshair Synchronization (`subscribeCrosshairMove` and `setCrosshairPosition`) with an internal `isSyncingRef` mutex guard to project a unified vertical crosshair line and accurate tooltips across all 4 subplots simultaneously without recursive event loop echoes.

## 5. Specialized Deep-Dive Quantitative Studios

- [x] 5.1 Implement `ValuationStudio.tsx` (`Valuation Pillar Studio`) displaying an interactive table and breakdown chart of all 17 Fundamental, Technical, and Sentiment indicators with piecewise linear interpolated scores and historical bubble risk threshold overlays.
- [x] 5.2 Implement `LttdLab.tsx` (`LTTD Lab`) featuring the 3-state Gaussian HMM stacked probability bar chart (`P_Bull`, `P_Bear`, `P_Sideways`), Log Returns vs 20-day Volatility scatter/time series, and PCA/VIF pruning metric diagnostics ($>10$).
- [x] 5.3 Implement `MttdConsole.tsx` (`MTTD Console`) visualizing the 10 Statistical Families consensus matrix (`Smoothing`, `Filtering`, `Regression`, `Spectral`, `Fractal`, `GARCH`, `Entropy`, `Chaos`, `Bayesian`, `ML-Hybrid`) and interactive gate inspection panels (`ER >= 0.20`, `Entropy <= 2.30`, `Chikou < -0.30`).
- [x] 5.4 Implement `IchimokuTerminal.tsx` (`Ichimoku Terminal`) plotting the stationary bounded $\tanh$ oscillator (`[-1.0, +1.0]`) alongside raw and Ehlers 2-pole SuperSmoother IIR cloud curves (`S_TK`, `S_Cloud`, `S_Future`, `S_Chikou`).

## 6. Verification & End-to-End Acceptance Harness

- [x] 6.1 Create automated Playwright verification test suite (`web/tests/chart-sync.spec.ts`) verifying that every chart subplot explicitly configures `rightPriceScale: { minimumWidth: 85 }` and asserting pixel-perfect vertical crosshair alignment across all 4 subplots.
- [x] 6.2 Run backend data synchronization pipeline `python3 run_report_pipeline.py` to verify canonical `MasterOHLCV` and WAL database concurrency are uncompromised and data feeds cleanly to port `:8765`.
- [x] 6.3 Execute Playwright UI verification tests (`bun test` / Playwright runner) and confirm Conventional Commits formatting (`feat(web): ...`, `test(web): ...`) before finalizing OpenSpec application.
