## Why

When a chart subplot is maximized (e.g., BTC, Valuation, or Equity) in the Valuation Studio, the `SdcaPanel` (SDCA Strategy Panel) erroneously receives the `fullscreen` class because it is passed `fullscreen={maximized !== null}`. This applies `.chart-panel.fullscreen` fixed-position styling to the SDCA panel at `z-index: 9999`, causing it to expand over the entire viewport and completely cover the focused chart, especially on mobile.

## What Changes

- Modify `ValuationStudio.tsx` to stop passing `fullscreen={maximized !== null}` to `SdcaPanel`. Instead, the SDCA panel will remain in normal document flow.
- Remove the `fullscreen` prop completely from `SdcaPanel.tsx` since the panel is never intended to be maximized.
- Rely on the existing parent `.chart-fullscreen-active` CSS container behavior, which automatically hides any `.chart-panel` that is not `.fullscreen` via the `.chart-fullscreen-active .chart-panel:not(.fullscreen) { display: none !important; }` rule in `index.css`. This ensures the SDCA panel cleanly disappears from the DOM flow when a chart is maximized.

## Non-goals

- Altering any chart scaling, calculations, or backtest logic.
- Modifying other studios (LTTD, MTTD, Ichimoku) as they do not use `SdcaPanel`.
- Modifying global CSS rules in `index.css`.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities

- `sdca-studio-panel`: Update responsive layout and visibility requirements to ensure the panel cleanly hides and does not overlap focused chart subplots when maximize state is active.

## Impact

- **Valuation Studio (`web/src/components/studios/ValuationStudio.tsx` & `SdcaPanel.tsx`)**: JSX property and component definition updates. No backend or database impact.
