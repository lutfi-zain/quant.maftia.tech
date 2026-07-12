## Why

When a chart panel is maximized on mobile in any of the 4 studio views (Valuation, LTTD, MTTD, Ichimoku), the `getPanelHeights()` function computes chart heights using `window.visualViewport?.height || window.innerHeight` — the full viewport height. However, the mobile layout has a 56px bottom tab bar (`BottomTabBar`) that is NOT hidden during maximize (it lives outside the `chart-fullscreen-active` container in `AppLayout`). This creates two problems:

1. The maximized chart panel overflows behind the bottom tab bar — the bottom ~56px of chart content is hidden behind the tab bar.
2. The Lightweight Charts `.resize()` internal canvas dimensions are set to the full viewport height, but the actual CSS-rendered container is `calc(100dvh - 56px)`, causing a canvas-to-container mismatch that results in incorrect chart rendering (clipped content, broken price scale, misaligned crosshair).

## What Changes

- Fix `getPanelHeights()` in all 4 studio components to subtract the mobile bottom tab bar height (56px) from the `full` height calculation when `isMobile` is true and a panel is maximized.
- On mobile, secondary panels in "semi-maximize" mode (e.g. 65/35 split for BTC + secondary pane) should also account for the bottom tab bar and any visible header.
- Ensure the chart resize effect uses the corrected heights so Lightweight Charts canvas dimensions match the actual CSS container dimensions.
- Consider adding a `MOBILE_BOTTOM_TAB_HEIGHT` constant (56px) to avoid magic numbers.

## Capabilities

### New Capabilities

- `mobile-maximize`: Correct chart panel maximize height behavior on mobile devices across all 4 studios. Accounts for bottom tab bar and mobile chrome when calculating maximized chart dimensions.

### Modified Capabilities
<!-- No existing specs to modify — this is a bugfix, not a spec-level requirement change. -->

## Impact

### Affected Files

- `web/src/components/studios/ValuationStudio.tsx` — `getPanelHeights()` function
- `web/src/components/studios/LttdLab.tsx` — `getPanelHeights()` function
- `web/src/components/studios/MttdConsole.tsx` — `getPanelHeights()` function
- `web/src/components/studios/IchimokuTerminal.tsx` — `getPanelHeights()` function

### Non-goals

- No changes to desktop maximize behavior (desktop has no bottom tab bar).
- No changes to the CSS `chart-panel.fullscreen` rules — the CSS is already correct with `height: calc(100dvh - 56px)`.
- No changes to `MetricDetailChart.tsx` — it doesn't have mobile maximize.
- No changes to the bottom tab bar or app layout structure.
