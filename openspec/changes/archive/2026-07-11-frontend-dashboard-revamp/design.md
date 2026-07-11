## Context

The Maftia Quant unified frontend (`web/`) is a React 19 + Vite + TypeScript SPA backed by a Hono/Bun API on `:8765`. It renders 4 deep-dive studios and a master executive dashboard using Lightweight Charts v5.2 for all charting.

The current implementation was built to establish the architecture skeleton. During unification, several UX features from the prior individual projects were not carried over. Additionally, charts are rendered as fully independent chart instances inside separate `glass-card` wrappers, which creates visual gaps between subplots and makes synchronized Y-axis alignment imperfect despite the 85px lock. Data is fetched with a `limit=365` cap, hiding all pre-2024 historical data from the charts. The color palette uses neon-cyan (`#00f0ff`) which reads as a gaming/sci-fi aesthetic rather than a professional institutional terminal.

**Current frontend file tree:**
```
web/src/
  index.css                        ← design tokens (neon cyan)
  context/TerminalContext.tsx      ← data fetch, WebSocket
  api/client.ts                    ← getDailyAnalytics(365) ← problem
  components/
    layout/AppLayout.tsx           ← header, no controls
    layout/Sidebar.tsx             ← nav only
    charts/MultiPaneChart.tsx      ← 4 separate glass-cards, no LOG/MAX
    dashboard/BentoSummary.tsx     ← 4 status cards
    studios/ValuationStudio.tsx    ← 1 chart only, no BTC anchor
    studios/LttdLab.tsx            ← 2 charts, no BTC anchor
    studios/MttdConsole.tsx        ← 2 charts, no BTC anchor
    studios/IchimokuTerminal.tsx   ← 2 charts, no BTC overlay
```

## Goals / Non-Goals

**Goals:**
- Show full Bitcoin price history from 2016 in all charts
- Alert user when server has newer data than what is loaded, with a one-click refetch
- Logarithmic/linear price scale toggle on all BTC price subplots
- Per-subplot maximize: BTC-only or BTC+subplot two-pane view
- Zero visual gap between stacked chart subplots (Bloomberg-style seamless panels)
- Every studio page anchors on a BTC Candlestick pane with full Ichimoku overlay in the Ichimoku Terminal
- Synchronized crosshair + visible logical range across all subplots within each studio
- Color palette rebranded to Bloomberg Slate Amber (institutional grade)

**Non-Goals:**
- Backend changes (API schema, Python engines, SQLite, WebSocket protocol)
- Mobile/responsive layout
- Light mode
- New API endpoints
- Backtest simulator or parameter tuning UI

## Decisions

### D1: Single container for multi-pane charts (no individual glass-cards per subplot)

**Decision**: Wrap all subplots in one `div.chart-panel` with `overflow: hidden; border-radius: 12px`. Each subplot `div` is a direct child with `border-top: 1px solid var(--border-panel)` (except the first). The outer container gets the glass background and border.

**Why**: Individual glass-cards with `gap: 12px` create a visual separation that makes the Y-axis time-tick alignment misleading even when 85px locked. A single container with divider lines between panels is the Bloomberg/TradingView standard.

**Alternative considered**: `gap: 0px` with `border-radius: 0` on inner cards — rejected because border-radius clipping still shows the card edges.

### D2: Lightweight Charts — time scale hidden on all subplots except the last

**Decision**: All non-bottom subplots render with `timeScale: { visible: false }`. Only the bottom subplot shows the time axis. This matches the prior `quant-lttd-ichimoku` implementation.

**Why**: Showing a time axis on every subplot wastes 25px per panel and creates visual noise. One shared time axis at the bottom is the industry standard.

### D3: Maximize state machine — `maximizedPanel: null | 'btc' | 'val' | 'lttd' | 'mttd' | 'ichi-osc' | 'ichi-cloud'`

**Decision**: A single React state in each chart component. When `null`, all panels visible at their default heights. When `'btc'`, only BTC pane renders at `calc(100vh - 200px)`. When a subplot ID is set, BTC pane renders at 65% and the chosen subplot at 35% of available height.

**Why**: This is the same approach used in `quant-lttd-ichimoku` (`isMaximized` flag with `getChartHeights()` helper). Clean state machine with zero additional React context needed.

**Alternative considered**: Draggable resize handles — rejected as Lightweight Charts does not expose native resize handles and implementing custom drag-resize adds significant complexity with no architectural benefit.

### D4: Data fetch — `limit=5000`, no `start_date` param

**Decision**: Change `getDailyAnalytics(365)` to `getDailyAnalytics(5000)`. The API already defaults `effectiveStartDate = '2010-01-01'` and caps at `limit=5000`, so no backend change is needed. 5000 rows covers ~13.7 years at daily granularity.

**Why**: Bitcoin daily data from 2016 is ~3,300 rows. 5000 provides a comfortable ceiling including future growth.

**Performance note**: Lightweight Charts v5.2 handles 3,000–5,000 candle data points with no degradation in desktop browsers (confirmed by prior project usage). The `verifyCausalData()` function in `client.ts` deduplicates and sorts in-memory efficiently.

### D5: Sync gap detection — `/api/v1/health` polling (one-time on mount)

**Decision**: In `TerminalContext`, after `refreshData()` completes, make a secondary `GET /api/v1/health` call. Extract `database.latest_data_timestamp`. Compare against `dailyData[dailyData.length - 1].date`. Store `{ serverDate, clientDate, gapDays }` in context. Expose in `AppLayout` header and `Sidebar`.

**Why**: The health endpoint already returns `latest_data_timestamp` and `total_records` — no new endpoint needed. One-time polling on mount is sufficient (data is daily, not real-time).

**Alternative considered**: Dedicated `/api/v1/analytics/latest` endpoint — unnecessary given health already provides this.

### D6: Color palette — Bloomberg Slate Amber

**Decision**: Replace the current neon cyan palette (`#00f0ff` accent) with:
```
--bg-root: #020617          /* slate-950 near-black navy */
--bg-card: #0F172A          /* slate-900 */
--bg-elevated: #1E293B      /* slate-800 */
--border-panel: #1E293B     /* panel divider */
--border-card: rgba(255,255,255,0.07)
--text-primary: #F8FAFC
--text-secondary: #94A3B8
--text-mono: #CBD5E1
--accent: #F59E0B           /* amber-400 — primary accent */
--accent-glow: rgba(245,158,11,0.15)
--signal-bull: #22C55E      /* green-500 */
--signal-bear: #EF4444      /* red-500 */
--signal-neutral: #F59E0B   /* amber-500 = sideways/cash */
--signal-quant: #60A5FA     /* blue-400 — data overlays */
--signal-pca: #A78BFA       /* violet-400 — HMM/PCA */
```

**Why**: Amber-gold is the authority color for quantitative finance (Bloomberg Terminal DNA). Deep navy is far more readable for 4+ hour trading sessions than near-black with neon glow. The contrast ratios for text-primary on bg-card exceed WCAG AA (>7:1).

### D7: IchimokuTerminal — rebuild with 3-pane architecture

**Decision**: Rebuild `IchimokuTerminal.tsx` to mirror the prior `quant-lttd-ichimoku` App.jsx chart architecture:
- Pane 1: BTC Candlestick + Tenkan-sen + Kijun-sen + Span A + Span B + Chikou Span (traditional). Log scale default.
- Pane 2: IMO bounded tanh Area + threshold price lines.
- Pane 3: S_TK, S_Cloud, S_Future, S_Chikou as line series.

Data for Tenkan/Kijun/Spans is currently not in the `unified_daily_analytics` API response. Workaround: compute approximate Tenkan/Kijun client-side from OHLCV `dailyData` using standard Ichimoku periods (9, 26, 52). For S-components, use the available `ichimoku_s_tk`, `ichimoku_s_cloud`, `ichimoku_s_future`, `ichimoku_s_chikou` fields if populated, else plot `ichimoku_imo` derivatives as fallback.

**Why**: The prior project had full Ichimoku overlay. Without it, the Ichimoku Terminal page has no price context, making the oscillator values uninterpretable for new users.

## Risks / Trade-offs

- **Ichimoku line data not in API** → Client-side computation of Tenkan/Kijun from OHLCV is a fair approximation but may drift slightly from server-computed values. Mitigation: label as "approximate" in the chart title until API enrichment.
- **5000-row initial load** → Slightly longer initial fetch (~200-400ms for full history). Mitigation: the loading state already shows the terminal splash screen; no UX degradation.
- **Glass-card hover `translateY` removal** → Some non-chart cards (BentoSummary) benefit from the hover lift. Mitigation: apply a new `.chart-panel` class without hover transform; keep `glass-card` hover only on non-chart containers like BentoSummary.
- **Crosshair sync between 3 panes** → The `requestAnimationFrame` sync guard from the current `MultiPaneChart.tsx` is sufficient; tested in prior project with 3-chart sync.

## Open Questions

- Should the Valuation, LTTD, MTTD pages also inherit the Log/Linear toggle on their BTC pane, or is LOG default-always sufficient? → Defaulting to LOG default, toggle available.
- Should the `⟳ Sync Data` button trigger a full re-fetch of all 5000 rows, or only the gap days? → Full re-fetch for simplicity (replaces state atomically).
