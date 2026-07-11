## Why

The entire frontend SPA (`/web`) is desktop-only. There are zero `@media` queries, zero responsive breakpoints, and a fixed 260px sidebar with hardcoded `margin-left: 260px` on the main content area. On any screen narrower than ~900px the interface clips, overflows, and becomes unusable. Data tables with 6-7 columns, `repeat(3, 1fr)` stat grids, and side-by-side chart+editor layouts all assume wide viewports. Users need to check quantitative signals on the go from their phones — including deep-dive studio analysis, not just the executive dashboard.

## What Changes

- **Sidebar → Bottom Tab Bar + Hamburger Drawer**: Replace the fixed 260px sidebar with a fixed bottom tab bar (5 navigation icons) on screens `<768px`. Secondary sidebar content (data range, gateway status) moves into a hamburger-triggered slide-over drawer. Main content gets `margin-left: 0` and `padding: 16px`.
- **Sticky Mobile Header**: Add a compact sticky header bar with the page title, hamburger menu trigger, and sync/refresh controls.
- **Compact List Tables**: Transform all 4 studio component `<table>` elements (6-7 columns each) into a compact two-line list layout on mobile. Line 1: indicator name + score. Line 2: category badge + sparkline + signal direction. Description column dropped (low-value on mobile). Each row remains tappable for drill-down.
- **Stacked Chart+Editor Layout**: The MetricDetail `1fr 280px` side-by-side grid becomes fully stacked on mobile — charts on top, threshold editor accessible via an iOS-style bottom sheet (slides up on tap, drag-dismissable).
- **Responsive Stat Grids**: Change `repeat(3, 1fr)` grids in LTTD Lab and MTTD Console to `repeat(auto-fit, minmax(140px, 1fr))`.
- **Mobile Y-Axis Width**: Relax the 85px right price scale lock to `65px` on screens `<768px` for more chart plotting area (290px → 310px on a 375px phone). Desktop remains 85px.
- **Touch Target Sizing**: Ensure all interactive elements (buttons, table rows, toggle controls) meet a minimum 44px tap target size on mobile.
- **Chart Height Adjustments**: Reduce stacked subplot heights on mobile (BTC: 160px, secondary panes: 120-140px) to fit within phone viewport without excessive scrolling.

## Capabilities

### New Capabilities
- `mobile-responsive-shell`: Bottom tab bar navigation, hamburger drawer, sticky mobile header, responsive sidebar/main layout toggle at 768px breakpoint
- `mobile-data-tables`: Compact two-line list layout for component matrix tables on mobile, replacing 6-7 column `<table>` elements
- `mobile-bottom-sheet`: iOS-style bottom sheet component for the threshold editor (slide-up, drag handle, backdrop dismiss)

### Modified Capabilities
- `executive-terminal-and-sandboxes`: Modify the 85px Y-axis lock requirement to allow 65px on mobile (`<768px`). Modify chart subplot heights for mobile viewports. Add responsive layout rules for bento grid cards and stat grids.
- `metric-detail-chart`: Modify the `1fr 280px` grid to stack vertically on mobile. Threshold editor moves into bottom sheet. Chart panel gets full-width layout.
- `chart-png-export`: No spec changes — PNG export captures the current canvas regardless of viewport size.
- `metric-sparklines`: No spec changes — sparklines are already compact SVGs that scale.

## Impact

**Frontend files affected:**
- `web/src/index.css` — All new `@media (max-width: 767px)` responsive rules
- `web/src/components/layout/Sidebar.tsx` — Conditional render: sidebar on desktop, bottom tab bar on mobile
- `web/src/components/layout/AppLayout.tsx` — Remove hardcoded `margin-left: 260px`, add sticky mobile header
- `web/src/components/dashboard/BentoSummary.tsx` — Already responsive (`auto-fit`), minor padding tweaks
- `web/src/components/charts/MultiPaneChart.tsx` — Mobile chart height + Y-axis width adjustments
- `web/src/components/studios/ValuationStudio.tsx` — Table → compact list on mobile
- `web/src/components/studios/LttdLab.tsx` — Table → compact list + responsive stat grid
- `web/src/components/studios/MttdConsole.tsx` — Table → compact list + responsive stat grid
- `web/src/components/studios/IchimokuTerminal.tsx` — Table → compact list
- `web/src/components/studios/MetricDetailChart.tsx` — Stacked layout + bottom sheet integration

**New files:**
- `web/src/components/layout/BottomTabBar.tsx` — Mobile bottom navigation
- `web/src/components/layout/MobileHeader.tsx` — Sticky mobile header
- `web/src/components/ui/BottomSheet.tsx` — Reusable iOS-style bottom sheet component

**No backend changes.** No API changes. No data pipeline changes. All 4 quantitative systems (Valuation, LTTD, MTTD, Ichimoku) are unaffected.

## Non-goals

- Native mobile app or PWA service worker — this is CSS/React responsive adaptation only
- Tablet-specific breakpoints (768px+ works with the existing sidebar layout)
- Touch gesture navigation (swipe between studios) — future iteration
- Offline mobile access
- Any changes to `quant-technical-indicator-bank` (deprecated and removed)
