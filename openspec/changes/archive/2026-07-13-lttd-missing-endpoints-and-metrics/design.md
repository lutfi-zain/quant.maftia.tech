## Context

The LTTD Studio (`LttdLab.tsx`) in the unified 4-system terminal currently provides a 4-pane synchronized chart, backtest metrics with an execution log, and a basic component telemetry table. However, compared to the prior standalone LTTD system (`quant-btc-lttd-system/`), several capabilities are missing:

1. **Dedicated LTTD API endpoints** — The prior system had 8 specific endpoints (`/api/lttd/latest`, `/history`, `/chart`, `/regime`, `/diagnostics`, `/onchain`, `/actions/run`). The current unified gateway has a consolidated `/api/v1/quant/daily` endpoint but no LTTD-specific routes, forcing the frontend to parse generic daily analytics and lose granularity.

2. **On-chain BRK metrics** — STH-MVRV, STH-NUPL, STH-SOPR charts with threshold override lines existed in the prior system but are absent from LttdLab.

3. **Feature diagnostics with expandable details** — The prior system had an interactive indicator panel with expandable rows showing formulas, descriptions, historical performance stats, and on-chain override logic.

4. **Pipeline control center** — The prior system had a `ControlCenter` component for triggering pipeline actions (sync, backfill, VIF audit) with real-time execution logs.

5. **Regime transition audit** — A table of historical BULL↔BEAR↔SIDEWAYS transitions with dates and scores.

6. **Server-side backtest** — A dedicated endpoint computing performance metrics (CAGR, Sharpe, Sortino, win rate, profit factor, max drawdown) server-side.

All new data is sourced from `unified_daily_analytics` and `unified_component_signals` in `maftia_quant.db`. Pipeline actions call the same Python scripts used by `run_report_pipeline.py`.

**Constraints:**

- All new data must pass the CausalFilter (t-1 stamp verification, no future data leakage).
- All new chart subplots must enforce the 85px Y-axis width lock and vertical crosshair sync.
- All new API routes must use parameterized SQL and WAL mode.
- All changes are scoped to LTTD System only.

## Goals / Non-Goals

**Goals:**

- Add 8 backend API routes under `/api/v1/lttd/` serving data from the unified database.
- Add 3 new frontend panels to LttdLab: On-Chain Metrics, Feature Diagnostics, Pipeline Control Center.
- Add Regime Transition Audit table.
- Expand the 4-pane chart to 5 panes (dedicated Final Score + Target Exposure + Regime State subplots).
- Add server-side backtest computation endpoint.
- Add frontend API client functions for all new endpoints.

**Non-Goals:**

- No changes to Valuation Studio, MTTD Console, or Ichimoku Terminal.
- No new Python scripts or pipeline changes — the backend spawns existing Python scripts.
- No WebSocket real-time updates for LTTD data.
- No migration of historical data — all data already exists in `maftia_quant.db`.
- No new database tables or schema changes.

## Decisions

### Decision 1: Backend route file structure

**New file `src/api/routes/lttd.ts`** registered under `/api/v1/lttd/` in `src/api/index.ts`.

Rationale: Keeps LTTD-specific logic isolated. The `metrics.ts` route file for Valuation System serves as the pattern. Each endpoint reads from `unified_daily_analytics` via `executeQuery()` in `db.ts`, the same shared DB connection.

Alternatives considered:

- Adding to `daily.ts` — would bloat the consolidated endpoint with LTTD-specific logic.
- Creating per-endpoint files — over-engineering for 8 related endpoints.

### Decision 2: On-chain data source

**Fetch from `maftia_quant.db`** via `unified_component_signals` with `system_source = 'LTTD'` and component names `STH-MVRV`, `STH-NUPL`, `STH-SOPR`.

Rationale: The prior system fetched from `bitview.space` with fallback mock data. Now that the unified pipeline stores on-chain data in the database, we read from the canonical source. If no LTTD on-chain data exists yet, the endpoint returns the valuation system's on-chain data as a fallback with a warning header.

### Decision 3: Pipeline actions via backend

**`POST /api/v1/lttd/actions/run`** uses `Bun.spawn()` to run Python scripts in the `quant-btc-lttd-system/` directory.

Rationale: Mirrors the prior system's `/api/actions/run` pattern. The project root is resolved to `/home/ubuntu/projects/quant-btc-lttd-system/` for the `run_pipeline.py`, `backfill.py`, etc. scripts.

### Decision 4: Server-side backtest

**`GET /api/v1/lttd/backtest`** computes performance metrics server-side from `unified_daily_analytics` data within the requested date range, returning CAGR, Sharpe, Sortino, win rate, profit factor, max drawdown, and trade list.

Rationale: The prior system computed metrics client-side. Moving this to the server ensures consistent results, removes browser computation burden, and allows caching. The implementation mirrors the `performance_report.py` Python script logic but in TypeScript on the backend.

### Decision 5: 5-pane chart expansion

**Add dedicated subplots for Final Score, Target Exposure, and Regime State** between the existing BTC Candlestick and HMM Probability panes.

Rationale: The prior LTTDChart showed 5 distinct panes. The current LttdLab embeds score and exposure in the backtest metrics bar but doesn't visualize them as time-series. Three new subplots: Final Score (area), Target Exposure (histogram), Regime State (step line -1/0/+1). The bottom (equity curve) pane shows the time axis.

### Decision 6: Panel composition strategy

**All new panels are inlined into `LttdLab.tsx`** rather than extracted into separate component files.

Rationale: Extracting into separate files is cleaner architecture but adds cross-file complexity. The existing LttdLab is a single file. However, given the significant size increase, **OnChainPanel** and **PipelineControlCenter** will be extracted to `web/src/components/studios/` as separate files, while Feature Diagnostics and Regime Transition Audit remain inlined.

## Risks / Trade-offs

- **[Risk] Backend spawns Python processes** → Slow response on first call (cold Python startup). Mitigation: Use `Bun.spawn` with a 30s timeout. Cache results for read-only endpoints (on-chain, backtest). The prior system had the same limitation.
- **[Risk] LTTD on-chain data may not exist in `maftia_quant.db`** → API returns empty results. Mitigation: Fall back to valuation system's on-chain component signals when LTTD on-chain data is empty, with a `x-data-source` response header.
- **[Risk] Pipeline actions run in project root of LTTD system** → `cwd` must resolve correctly. Mitigation: Use `/home/ubuntu/projects/quant-btc-lttd-system/` as the resolved `cwd` regex check.
- **[Risk] LttdLab.tsx file size growth** → The file is already ~900 lines. Adding all new panels inline could push it to 2000+. Mitigation: Extract OnChainPanel and PipelineControlCenter into separate files in `web/src/components/studios/`.

## Open Questions

- Should the on-chain metrics panel share crosshair synchronization with the main 5-pane chart? Initially no — it remains an independent panel below the chart. Can be wired in a future change.
