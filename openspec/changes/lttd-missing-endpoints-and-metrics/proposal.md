## Why

The current LTTD Studio (in quant.maftia.tech) was built against the unified API gateway but lacks several critical endpoints and frontend panels that existed in the prior standalone LTTD system (`quant-btc-lttd-system/`). This creates a gap where LTTD-specific operational data — pipeline actions, on-chain BRK metrics, regime transition audit logs, detailed VIF/PCA diagnostics with expandable per-indicator explanations, and dedicated server-side backtest computation — is unavailable in the unified terminal. Closing this gap ensures LTTD operators have the same depth of control and diagnostics they had in the prior system, now within the unified 4-system architecture.

## What Changes

- Add **7 new backend API routes** under `/api/v1/lttd/` to mirror prior system endpoints (latest LTTD, history, chart, regime, diagnostics, on-chain, actions/run), reading from the unified `maftia_quant.db` (`unified_daily_analytics` + `unified_component_signals`) instead of the old `lttd.db`.
- Add **1 new backend route** `/api/v1/lttd/backtest` for server-side performance metrics computation.
- Add **3 new frontend panels** to `LttdLab.tsx`: On-Chain Metrics Panel (STH-MVRV, STH-NUPL, STH-SOPR charts), Feature Diagnostics Panel (expandable per-indicator VIF/PCA details + on-chain override logic), and Pipeline Control Center (action trigger buttons with execution log).
- Add **Regime Transition Audit Table** to LttdLab showing historical BULL↔BEAR↔SIDEWAYS transitions.
- Enhance the existing 4-pane chart to **5 panes** by exposing dedicated Final Score, Target Exposure, and Regime State subplots (matching the prior LTTDChart).
- Add **client API functions** in `web/src/api/client.ts` for all new endpoints.
- No breaking changes to existing API routes.

## Capabilities

### New Capabilities

- `lttd-dedicated-endpoints`: Backend API routes under `/api/v1/lttd/` for latest, history, chart, regime, diagnostics, on-chain, actions, and backtest — all from unified data sources.
- `onchain-metrics-panel`: Frontend panel in LttdLab showing STH-MVRV, STH-NUPL, STH-SOPR line charts with threshold override lines.
- `feature-diagnostics-panel`: Frontend panel showing interactive indicator breakdown with VIF/PCA stats, expandable indicator details (formula, description, historical performance), and on-chain override logic explanation.
- `pipeline-control-center`: Frontend panel with action trigger buttons (sync today, recover 10d, sync gap, VIF audit, full repopulation) and real-time execution log.
- `lttd-backtest-server`: Server-side backtest route that computes performance metrics (CAGR, Sharpe, Sortino, win rate, profit factor, max drawdown) from unified daily analytics data.
- `regime-transition-audit`: Frontend table showing historical regime change events with dates and scores.
- `enhanced-5-pane-chart`: Expand current 4-pane LTTD chart to 5 panes, matching prior system's dedicated Final Score + Target Exposure + Regime State subplots.

### Modified Capabilities

- *(No existing spec changes — this is a new addition to existing LTTD Studio, not a spec-level behavior change to existing capabilities.)*

## Impact

- **Backend** (`src/api/`): New routes file `src/api/routes/lttd.ts` added; registered in `src/api/index.ts` under `/api/v1/lttd/`. New DB helper functions in `src/api/db.ts` for LTTD-specific queries.
- **Frontend** (`web/src/components/studios/LttdLab.tsx`): Significant expansion with 3 new panels and chart enhancements. New panel sub-components in `web/src/components/studios/`. New API client functions in `web/src/api/client.ts`.
- **Dependencies**: No new packages. Uses existing Lightweight Charts, lucide-react icons, and Hono router. Pipeline actions spawn Python scripts (Bun.spawn via backend).
- **Systems affected**: LTTD System (System 02) only. Valuation, MTTD, Ichimoku are untouched.

## Non-goals

- Do NOT modify or reference `quant-technical-indicator-bank` (deprecated).
- Do NOT change the existing `/api/v1/analytics/daily` or `/api/v1/quant/daily` endpoints.
- Do NOT modify the Valuation Studio, MTTD Console, or Ichimoku Terminal.
- Do NOT introduce real-time WebSocket updates for LTTD-specific data (deferred to a future change).

## Gap Analysis Summary

| Prior System Endpoint | Current LTTD Studio | Action |
|---|---|---|
| `GET /api/lttd/latest` | ❌ Missing | Add `/api/v1/lttd/latest` |
| `GET /api/lttd/history` | ❌ Missing | Add `/api/v1/lttd/history` |
| `GET /api/chart` | ❌ Missing | Add `/api/v1/lttd/chart` |
| `GET /api/regime` | ❌ Missing | Add `/api/v1/lttd/regime` |
| `GET /api/diagnostics` | ❌ Missing | Add `/api/v1/lttd/diagnostics` |
| `GET /api/onchain` | ❌ Missing | Add `/api/v1/lttd/onchain` |
| `POST /api/actions/run` | ❌ Missing | Add `/api/v1/lttd/actions/run` |
| Performance metrics (client-side) | ✅ Partial | Add server-side `/api/v1/lttd/backtest` |
| 5-pane chart | ✅ 4 panes (missing score+exposure+regime) | Expand to 5 panes |
| Regime transition audit | ❌ Missing | Add table |
| On-chain BRK panel | ❌ Missing | Add panel |
| Feature diagnostics (expandable) | ❌ Missing (basic table only) | Add interactive panel |
| Pipeline control center | ❌ Missing | Add panel |
