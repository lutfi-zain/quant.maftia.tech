## Why

The current unified frontend dashboard (`quant.maftia.tech`) is missing critical UX features that existed in each prior individual project (`quant-lttd-ichimoku`, `quant-btc-valuation-system`, etc.) but were not carried over during unification. Key gaps include: no logarithmic/linear scale toggle, no per-subplot maximize mode, subplots rendered as separate glass-cards with visible 12-24px gaps instead of a seamlessly attached multi-pane chart, data history limited to only 365 days (truncating Bitcoin's 2016-2026 macro cycle), no refetch/sync-gap detection UI, missing BTC price overlay in all four studio sub-pages (Valuation, LTTD, MTTD, Ichimoku), and a color palette that reads as "sci-fi neon" rather than a professional institutional terminal.

## What Changes

- **Data fetch range**: Increase from `limit=365` to `limit=5000` to expose full Bitcoin history from 2016 onward.
- **Sync gap detection**: On app mount, compare the server's `latest_data_timestamp` (from `/api/v1/health`) against the latest date in loaded data; expose a badge showing gap days and a manual `⟳ Sync Data` button.
- **Log/Linear toggle**: Add a `[LOG | LIN]` toggle in the MultiPaneChart header that calls `priceScale('right').applyOptions({ mode: PriceScaleMode.Logarithmic | Normal })` on the BTC price subplot only.
- **Per-subplot Maximize**: Three-state maximize mode per chart container — `null` (show all 4 panels), `'btc'` (BTC fullscreen only), `'<subplot>'` (BTC + chosen subplot, 65/35 split). Crosshair sync remains active.
- **Seamless panel layout**: Replace 4 separate `glass-card` chart divs with a single zero-gap container; subplot headers rendered inline above each chart `div`.
- **Dashboard MultiPaneChart — Ichimoku overlay fix**: Replace the approximate `close ± cloud*500` cloud proxy with proper `ichimoku_imo` + raw S-component lines sourced from `unified_daily_analytics`.
- **ValuationStudio**: Add BTC Candlestick subplot above the existing Valuation Composite chart; implement crosshair + logical range sync between the two panes.
- **LttdLab**: Add BTC Candlestick subplot (with regime-colored background bands) above HMM Probabilities and Volatility charts; implement 3-pane crosshair + range sync.
- **MttdConsole**: Add BTC Candlestick subplot above MTTD IMO and Gates charts; implement 3-pane sync. Replace "Traffic Light" gate status from a simple table row to an explicit `[●PASS|●FAIL]` visual indicator badge row.
- **IchimokuTerminal**: Full rebuild — add BTC Candlestick + Tenkan/Kijun/Span A/Span B/Chikou overlay as Subplot 1; Bounded tanh IMO as Subplot 2; S_TK/S_Cloud/S_Future/S_Chikou lines as Subplot 3. 3-pane sync throughout.
- **Color palette revamp**: Replace the current Obsidian HSL neon cyan palette with Bloomberg Slate Amber — deep navy backgrounds (`#020617`, `#0F172A`), amber gold accent (`#F59E0B`), high-contrast text (`#F8FAFC`), status signal colors (`#22C55E` bull, `#EF4444` bear, `#F59E0B` sideways/neutral).
- **Remove layout-shifting hover**: Remove `transform: translateY(-2px)` from `glass-card:hover` on chart-containing elements to prevent resize-loop jitter.
- **Sidebar enhancement**: Add data range display (`2016-01-01 → today, N trading days`) and live sync-gap indicator.

## Capabilities

### New Capabilities

- `chart-panel-layout`: Seamless zero-gap multi-pane chart container with inline subplot headers, log/linear toggle, and per-subplot maximize behavior for all chart views (Dashboard + 4 Studios).
- `sync-gap-detection`: On-mount health check comparing server `latest_data_timestamp` vs client data tail date; badge showing gap days; manual refetch trigger.
- `full-history-data`: Full Bitcoin data load from 2016 (limit=5000 via `/api/v1/analytics/daily`) replacing the 365-day truncated view.
- `btc-price-overlay-studios`: BTC Candlestick subplot as anchor pane in all 4 studio pages (Valuation, LTTD, MTTD, Ichimoku) with crosshair + logical range sync across all subplots.
- `ichimoku-chart-rebuild`: Full Ichimoku Terminal with BTC + cloud overlay (Tenkan/Kijun/Span A/B/Chikou) + IMO oscillator + S-component lines in 3 synchronized panels.
- `bloomberg-slate-palette`: New design token set replacing neon cyan with institutional amber-gold-navy palette throughout `index.css` and all component inline styles.

### Modified Capabilities

_(No existing `openspec/specs/` capability specs exist yet — all are new.)_

## Impact

- **Frontend files**: `web/src/index.css`, `web/src/context/TerminalContext.tsx`, `web/src/api/client.ts`, `web/src/components/layout/AppLayout.tsx`, `web/src/components/layout/Sidebar.tsx`, `web/src/components/charts/MultiPaneChart.tsx`, `web/src/components/studios/ValuationStudio.tsx`, `web/src/components/studios/LttdLab.tsx`, `web/src/components/studios/MttdConsole.tsx`, `web/src/components/studios/IchimokuTerminal.tsx`
- **API**: No schema changes. `/api/v1/analytics/daily` already supports `limit=5000` and `start_date=2010-01-01`. `/api/v1/health` already returns `latest_data_timestamp`. No backend modifications needed.
- **Dependencies**: `lightweight-charts v5.2` (already installed) — `PriceScaleMode.Logarithmic` already exported.
- **Systems impacted**: All 4 Unified Systems' frontend representations — Valuation, LTTD, MTTD, Ichimoku. Python backend and SQLite pipeline untouched.

## Non-Goals

- No changes to Python data pipelines, quant engines, or SQLite schema.
- No changes to the Hono API Gateway (`src/api/`), WebSocket server, or any backend route logic.
- No changes to `quant-technical-indicator-bank` (deprecated — do not reference).
- No mobile/responsive redesign (desktop terminal is the primary target).
- No dark/light mode toggle (dark-only terminal remains canonical).
- No new API endpoints beyond what already exists.
