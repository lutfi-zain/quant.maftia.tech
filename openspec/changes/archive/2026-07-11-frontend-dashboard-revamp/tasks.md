## 1. Foundation — Design Tokens & CSS

- [x] 1.1 Replace all neon-cyan CSS variables in `web/src/index.css` with the Bloomberg Slate Amber palette (`--bg-root`, `--bg-card`, `--bg-elevated`, `--bg-chart`, `--border-card`, `--border-panel`, `--text-primary`, `--text-secondary`, `--text-dim`, `--text-mono`, `--accent`, `--accent-glow`, `--signal-bull`, `--signal-bear`, `--signal-neutral`, `--signal-quant`, `--signal-pca`)
- [x] 1.2 Add `@import` for Inter and JetBrains Mono fonts from Google Fonts in `index.css`; update font-family rules to use Inter for headings and JetBrains Mono for data values
- [x] 1.3 Add `.chart-panel` CSS class with glass background and border but WITHOUT `transform: translateY(-2px)` hover; retain `glass-card:hover` translateY only for non-chart cards
- [x] 1.4 Add `.chart-subplot` CSS class for individual panes within `.chart-panel`: `border-top: 1px solid var(--border-panel)` on all except `:first-child`
- [x] 1.5 Update all existing component inline styles that reference hardcoded neon-cyan hex (`#00f0ff`, `#0055ff`) to use the new CSS variable `var(--accent)` or appropriate signal variables
- [x] 1.6 Update `.nav-item.active` and focus ring CSS to use `var(--accent)` (amber) instead of cyan

## 2. Data Layer — Full History & Sync Gap

- [x] 2.1 In `web/src/api/client.ts`, change `getDailyAnalytics(days: number = 365)` to `getDailyAnalytics(limit: number = 5000)` — update the API call to pass `limit` as query param instead of computing `start_date`
- [x] 2.2 In `web/src/context/TerminalContext.tsx`, update `refreshData()` to call `getDailyAnalytics(5000)` and remove any date arithmetic that was limiting to 365 days
- [x] 2.3 In `TerminalContext.tsx`, add `syncGap: { serverDate: string | null; clientDate: string | null; gapDays: number }` state initialized to `{ serverDate: null, clientDate: null, gapDays: 0 }`
- [x] 2.4 In `TerminalContext.tsx`, after `refreshData()` resolves, call `GET /api/v1/health` (using `quantClient.getHealth()` or direct fetch), extract `database.latest_data_timestamp`, compute `gapDays`, and update `syncGap` state
- [x] 2.5 Add `getHealth()` method to `web/src/api/client.ts` that calls `GET /api/v1/health` and returns `{ latest_data_timestamp: string; total_records: number }`
- [x] 2.6 Export `syncGap` from `TerminalContext` so `AppLayout` and `Sidebar` can consume it

## 3. Layout — AppLayout & Sidebar Enhancements

- [x] 3.1 In `web/src/components/layout/AppLayout.tsx`, add sync gap badge in header: conditionally render `⚠ N day(s) behind` (amber, warning) or `✓ Data current` (green) based on `syncGap.gapDays`
- [x] 3.2 Add `⟳ Sync Data` button in header that calls `refreshData()` from context; show spinner (`animate-spin`) on the icon while `loading === true`
- [x] 3.3 Remove the "85px Y-AXIS LOCK" and "SQLite WAL" decorative badges from the header
- [x] 3.4 In `web/src/components/layout/Sidebar.tsx`, add a `DATA RANGE` section at the bottom showing earliest/latest dates from `dailyData` and total trading day count, plus the sync gap indicator

## 4. MultiPaneChart — Seamless Panels + Log/Linear + Maximize

- [x] 4.1 Restructure `web/src/components/charts/MultiPaneChart.tsx` container: replace 4 separate `glass-card` `div`s with a single `div.chart-panel` wrapper; each subplot `div` uses `.chart-subplot` class
- [x] 4.2 Move each subplot's label/header inline within the `.chart-panel` as a thin `div` above the chart container (no padding waste from separate card headers)
- [x] 4.3 Add `isLogScale` state in `MultiPaneChart`; add `[LOG | LIN]` toggle in the top header area; apply `PriceScaleMode.Logarithmic / Normal` to the BTC price chart via `useEffect` on `isLogScale` change
- [x] 4.4 Add `maximizedPanel: null | 'btc' | 'val' | 'lttd' | 'mttd'` state; add maximize `⤢` button to each subplot header
- [x] 4.5 Implement maximize height logic: `maximizedPanel === null` → all 4 panels at default heights (btc: 280px, val/lttd/mttd: 160px each); `maximizedPanel === 'btc'` → BTC at `calc(100vh - 160px)`, others hidden; `maximizedPanel === '<id>'` → BTC at `65%`, selected at `35%`, others hidden
- [x] 4.6 Apply `timeScale: { visible: false }` to all non-bottom-visible subplots dynamically based on maximize state (bottom-most visible subplot always shows time axis)
- [x] 4.7 Verify crosshair sync and visible logical range sync still works correctly after the restructure (the `subscribeVisibleLogicalRangeChange` and `subscribeCrosshairMove` logic should be unchanged)

## 5. ValuationStudio — 2-Pane Rebuild

- [x] 5.1 Add `btcChartRef` and `btcChart` instance to `ValuationStudio.tsx`; create BTC Candlestick chart as Pane 1 above the existing Valuation chart; initialize with log scale, `timeScale: { visible: false }`
- [x] 5.2 Set BTC candlestick data from `dailyData.map(p => ({ time: p.date, open: p.master_ohlcv.open, high: p.master_ohlcv.high, low: p.master_ohlcv.low, close: p.master_ohlcv.close }))`
- [x] 5.3 Implement bidirectional crosshair sync (via `subscribeCrosshairMove`) and visible logical range sync between the BTC pane and Valuation Composite pane
- [x] 5.4 Implement visible logical range sync (`subscribeVisibleLogicalRangeChange`) between both panes
- [x] 5.5 Wrap both charts in a single `.chart-panel` container; BTC pane height 280px, Valuation pane height 220px; only Valuation pane shows time axis
- [x] 5.6 Add `isLogScale` toggle button in studio header; apply to BTC price scale
- [x] 5.7 Add maximize `⤢` button with `maximizedPanel: null | 'btc' | 'val'` state; `'btc'` hides Valuation pane, `'val'` shows both at 65/35

## 6. LttdLab — 3-Pane Rebuild

- [x] 6.1 Add BTC Candlestick Pane 1 to `LttdLab.tsx` above existing HMM chart; log scale default, `timeScale: { visible: false }`
- [x] 6.2 Set BTC data from `dailyData` master_ohlcv; apply amber candle colors for BULL regime dates, red for BEAR, grey for SIDEWAYS using background bands via `createPriceLine` or HTML canvas overlay (simpler: use a regime color for candle wicks)
- [x] 6.3 Ensure the existing HMM Probabilities chart becomes Pane 2 with `timeScale: { visible: false }` (only the Volatility pane at bottom shows time axis)
- [x] 6.4 Implement 3-way crosshair sync and visible logical range sync across all 3 panes
- [x] 6.5 Wrap all 3 charts in a single `.chart-panel` container; heights: BTC 260px, HMM 180px, Vol 160px
- [x] 6.6 Add `isLogScale` toggle and maximize `⤢` button (`null | 'btc' | 'hmm' | 'vol'` state)

## 7. MttdConsole — 3-Pane Rebuild

- [x] 7.1 Add BTC Candlestick Pane 1 to `MttdConsole.tsx` above existing IMO chart; log scale default, `timeScale: { visible: false }`
- [x] 7.2 Set BTC data from `dailyData` master_ohlcv
- [x] 7.3 Ensure existing IMO chart becomes Pane 2 and Gates chart becomes Pane 3; only Pane 3 shows time axis; `timeScale: { visible: false }` on Panes 1 and 2
- [x] 7.4 Implement 3-way crosshair sync and visible logical range sync
- [x] 7.5 Wrap all 3 charts in single `.chart-panel`; heights: BTC 260px, IMO 180px, Gates 160px
- [x] 7.6 Replace the simple table gate status with a traffic-light badge row: three `div.gate-badge` elements showing `ER ≥ 0.20 [●PASS]` / `[●FAIL]`, `H ≤ 2.30 [●PASS]` / `[●FAIL]`, `Chikou [●ACTIVE]` / `[●CLEAR]`, colored green/red/amber respectively based on latest `mttd_er`, `mttd_entropy` values
- [x] 7.7 Add `isLogScale` toggle and maximize `⤢` button

## 8. IchimokuTerminal — Full 3-Pane Rebuild

- [x] 8.1 Add utility function `computeIchimokuLines(dailyData)` in `IchimokuTerminal.tsx` that computes Tenkan(9), Kijun(26), Span A, Span B, Chikou(26 lag) from `master_ohlcv` OHLCV arrays using strictly causal rolling max/min
- [x] 8.2 Create Pane 1: BTC Candlestick chart; add Tenkan-sen (line, `#F87171`), Kijun-sen (line, `#60A5FA`), Span A (line, `rgba(34,197,94,0.25)`), Span B (line, `rgba(239,68,68,0.25)`), Chikou (line, `rgba(168,85,247,0.5)`) — all as separate LineSeries; log scale, `timeScale: { visible: false }`
- [x] 8.3 Set Tenkan/Kijun/SpanA/SpanB data from computed values starting at appropriate bar index (skip NaN warmup bars)
- [x] 8.4 Set Chikou data: `timeseries[i].date` → `value: timeseries[i + 26].close` where `i + 26 < length`
- [x] 8.5 Create Pane 2: `ichimoku_imo` AreaSeries (`#A78BFA` / violet); add `+0.50` (green dashed) and `-0.50` (red dashed) price lines; add `0.00` (white 20% opacity) baseline; `timeScale: { visible: false }`
- [x] 8.6 Create Pane 3: S_TK (cyan `#22D3EE`), S_Cloud (amber `#F59E0B`), S_Future (violet `#A78BFA`), S_Chikou (green `#22C55E`) as LineSeries; shows time axis
- [x] 8.7 For Pane 3 data: use `p.ichimoku_s_tk`, `p.ichimoku_s_cloud`, `p.ichimoku_s_future`, `p.ichimoku_s_chikou` if defined and non-null; otherwise fall back to `p.ichimoku_imo * factor` approximations
- [x] 8.8 Implement 3-way bidirectional crosshair sync (`subscribeCrosshairMove` with `setCrosshairPosition` / `clearCrosshairPosition`)
- [x] 8.9 Implement 3-way visible logical range sync (`subscribeVisibleLogicalRangeChange` with `isSyncing` guard)
- [x] 8.10 Wrap all 3 charts in single `.chart-panel`; heights: Pane 1 320px, Pane 2 180px, Pane 3 160px
- [x] 8.11 Add `isLogScale` toggle, maximize `⤢` button (`null | 'btc' | 'imo' | 'scomp'` state)
- [x] 8.12 Remove the old standalone `oscChartContainerRef` and `cloudChartContainerRef` glass-card panels that were the previous Pane 1 and Pane 2 — replace entirely with the new 3-pane architecture

## 9. Final Polish & Verification

- [x] 9.1 Run `bun run dev` in `web/` and visually verify all 5 views (Dashboard + 4 Studios) render without white gaps between chart subplots
- [x] 9.2 Verify log/linear toggle works on all BTC price panes (apply options without remount)
- [x] 9.3 Verify maximize works in each studio: BTC-only fullscreen, subplot+BTC two-pane, restore to full
- [x] 9.4 Verify crosshair sync: mouse over top pane shows crosshair on all synchronized subplots simultaneously
- [x] 9.5 Verify sync gap badge: check if server date vs client data tail date difference is computed and displayed correctly
- [x] 9.6 Verify data timeline: open browser DevTools, check `dailyData.length > 3000` and earliest entry date is ≤ 2017-01-01
- [x] 9.7 Verify amber accent color applied throughout (nav active state, sync badge, accent buttons)
- [x] 9.8 Run `python3 run_report_pipeline.py` to confirm no Python backend regressions from any accidental file modification

## 10. Maximize Bugfix (2026-07-09)

- [x] 10.1 Fix charts disappearing after maximize/restore cycle — containers were removed from DOM when height=0 via conditional rendering (`{heights.x > 0 && (...)}`), but chart init useEffect only depended on `dailyData` and didn't re-run to recreate charts. Fix: always render containers, hide with CSS class `.chart-subplot-hidden` (height: 0, overflow: hidden) instead of conditional rendering.
- [x] 10.2 Fix maximize not covering full viewport — `getPanelHeights` used `window.innerHeight - 220` which left 220px gap. Fix: use `window.innerHeight` directly for fullscreen. Add `.chart-panel.fullscreen` CSS class with `position: fixed; width: 100vw; height: 100vh; z-index: 9999`.
- [x] 10.3 Fix toolbar/header/sidebar still visible when maximized — parent div gets `.chart-fullscreen-active` class which hides all non-chart elements via CSS rule `.chart-fullscreen-active > *:not(.chart-panel) { display: none }`.
- [x] 10.4 Apply maximize bugfix to all 4 studios (ValuationStudio, LttdLab, MttdConsole, IchimokuTerminal) and MultiPaneChart.
- [x] 10.5 Add `database` property to `HealthResponse` type in `api/types.ts` for sync gap detection.
- [x] 10.6 Fix React 19 `RefObject<HTMLDivElement | null>` type mismatch in MultiPaneChart.tsx.
