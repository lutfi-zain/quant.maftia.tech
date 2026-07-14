## 1. Clean Up Layout and Container Refs

- [x] 1.1 Remove `scompContainerRef` from DOM and component state in `IchimokuTerminal.tsx`
- [x] 1.2 Update `getPanelHeights()` and `getChartHeights()` to support a 3-pane layout (Price Action, Denoising Gates & Entropy, Cumulative Equity Growth)
- [x] 1.3 Remove separate Pane 3 (`scompChart`) container and clean up markup in `IchimokuTerminal.tsx`

## 2. Refactor Chart Instantiation

- [x] 2.1 Refactor chart options and creation inside `useEffect` (mount) to instantiate exactly 3 charts: `priceChart`, `oscChart` (combining IMO, Threshold, Entropy, and S_Chikou), and `equityChart`
- [x] 2.2 Re-wire `traditionalChikouSeries` on `priceChart` as a purple line series
- [x] 2.3 Set up `oscChart` with `imoSeries`, `threshSeries`, `entropySeries`, and `chikouSeries` matching the colors from `quant-lttd-ichimoku`
- [x] 2.4 Synchronize logical visible ranges and crosshairs across exactly 3 charts, clearing crosshairs on mouseout
- [x] 2.5 Ensure `rightPriceScale.minimumWidth: 85` and trigger `syncYAxisWidth` across the 3 subplots

## 3. Map Data and Render Series

- [x] 3.1 On `priceChart` data load, calculate client-side traditional Chikou span by shifting the Close price forward by `params.p2` days (using `i + params.p2` logic)
- [x] 3.2 Add transaction markers (BUY/SELL arrows) on `candleSeries` when positions change
- [x] 3.3 Map and load data for `imoSeries`, `threshSeries` (Standard Deviation * `params.t_entry`), `entropySeries`, and `chikouSeries` (`ichimoku_s_chikou`) onto `oscChart`
- [x] 3.4 Dynamically draw and remove `Entropy Limit` and `Chikou Exit` price lines on `oscChart` inside the parameter updates `useEffect`

## 4. Verification and Clean Up

- [x] 4.1 Validate code correctness with TypeScript and Bun compile check (build validation)
- [x] 4.2 Run validation script `python3 verify_ichimoku_studio_metrics_1to1.py` to confirm alignment of metrics
- [x] 4.3 Ensure commits follow the Conventional Commits specification
