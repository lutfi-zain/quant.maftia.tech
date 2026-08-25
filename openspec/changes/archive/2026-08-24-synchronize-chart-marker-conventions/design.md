## Context

See `proposal.md` for background.

Currently, `MultiPaneChart.tsx` generates static inline markers based on `valuation_composite` + `lttd_regime`, while `ValuationStudio.tsx` renders dynamic markers from `backtestResult.markers` (which are SDCA weekly calendar execution orders).

## Goals / Non-Goals

**Goals:**
- Provide clear visual taxonomy for markers in `ValuationStudio.tsx`:
  - **Orders**: Directional arrows (`#10B981` Green for buys, `#EF4444` Red for sells).
  - **Macro Confluence**: Cyan `#00F0FF` for `VAL ACCUM`, Magenta `#F43F5E` for `VAL BUBBLE`.
- Add an interactive marker filter button/selector in the Valuation Studio toolbar to toggle between Macro Confluence and Strategy Orders.

**Non-Goals:**
- No changes to trading engine calculation logic.

## Decisions

### Decision 1: Unified Marker Generator in ValuationStudio.tsx
Construct markers based on the active view selection:
- If `markerMode === 'strategy'` (default): Render SDCA execution markers.
- If `markerMode === 'confluence'`: Render `valuation_composite` + `lttd_regime` confluence markers identical to Master Dashboard.
- If `markerMode === 'both'`: Merge both sets with distinct shapes.

## Risks / Trade-offs

- **Chart Visual Density**: Rendering too many markers simultaneously on low zoom levels can clutter the candlestick chart. Limit text label visibility or use subtle shapes when zoomed out.
