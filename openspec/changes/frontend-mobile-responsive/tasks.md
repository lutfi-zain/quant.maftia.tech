## 1. Foundation: Responsive Hook and CSS Breakpoint System

- [x] 1.1 Create `web/src/hooks/useIsMobile.ts` — a `useIsMobile(breakpoint = 768)` React hook wrapping `window.matchMedia('(max-width: ${breakpoint - 1}px)')` with a `change` event listener that returns a reactive `boolean`
- [x] 1.2 Add `@media (max-width: 767px)` responsive section to `web/src/index.css` with CSS custom property `--chart-yaxis-width: 65px` (default root value remains `85px`), mobile padding overrides, and `.mobile-hidden` / `.desktop-hidden` utility classes
- [x] 1.3 Add `@keyframes slideInLeft` / `slideOutLeft` and `@keyframes slideUpSheet` / `slideDownSheet` animation keyframes to `web/src/index.css` for drawer and bottom sheet transitions

## 2. Mobile Navigation Shell

- [x] 2.1 Create `web/src/components/layout/BottomTabBar.tsx` — fixed bottom nav with 5 icon+label buttons (`Dashboard`, `Valuation`, `LTTD`, `MTTD`, `Ichimoku`), `height: 56px`, `z-index: 50`, active tab highlighting with amber accent, minimum `44px` touch targets
- [x] 2.2 Create `web/src/components/layout/MobileHeader.tsx` — sticky top header (`height: 56px`) with hamburger icon (☰), dynamic page title from `PAGE_TITLES[activeTab]`, and sync/refresh badge + button
- [x] 2.3 Create hamburger slide-over drawer inside `MobileHeader.tsx` — left-side overlay panel with brand logo, data range summary, API gateway status, and backdrop dismiss (`rgba(0,0,0,0.5)`)
- [x] 2.4 Update `web/src/components/layout/AppLayout.tsx` — conditionally render `<Sidebar>` on desktop and `<MobileHeader>` + `<BottomTabBar>` on mobile using `useIsMobile()`. Set main content `margin-left: 0` and `padding: 16px 16px 72px 16px` on mobile

## 3. Reusable Bottom Sheet Component

- [x] 3.1 Create `web/src/components/ui/BottomSheet.tsx` — iOS-style slide-up panel rendered via `createPortal` into `document.body` with `z-index: 10000`, drag handle bar (`36×4px`), semi-transparent backdrop, three snap states (`closed`/`peek` at 40vh/`expanded` at 85vh), touch gesture drag-to-dismiss via `touchstart`/`touchmove`/`touchend`, and `onClose()` callback

## 4. Responsive Chart Sizing

- [x] 4.1 Update `web/src/components/charts/MultiPaneChart.tsx` — read `--chart-yaxis-width` via `getComputedStyle()` for `rightPriceScale.minimumWidth` instead of hardcoded `85`. Use mobile subplot heights (BTC: `160px`, secondary: `120px`) when `useIsMobile()` is true
- [x] 4.2 Update `web/src/components/studios/ValuationStudio.tsx` — read `--chart-yaxis-width` for all chart `rightPriceScale.minimumWidth` values. Adjust composite chart height allocation on mobile
- [x] 4.3 Update `web/src/components/studios/LttdLab.tsx` — read `--chart-yaxis-width` for chart Y-axis width. Use mobile subplot heights (`160px`/`120px`). Change stat grid from `repeat(3, 1fr)` to `repeat(auto-fit, minmax(140px, 1fr))`
- [x] 4.4 Update `web/src/components/studios/MttdConsole.tsx` — read `--chart-yaxis-width` for chart Y-axis width. Use mobile subplot heights (`160px`/`120px`). Change stat grid from `repeat(3, 1fr)` to `repeat(auto-fit, minmax(140px, 1fr))`
- [x] 4.5 Update `web/src/components/studios/IchimokuTerminal.tsx` — read `--chart-yaxis-width` for chart Y-axis width. Use mobile subplot heights (`160px`/`120px`)

## 5. Mobile Compact List Tables

- [x] 5.1 Update `web/src/components/studios/ValuationStudio.tsx` — when `useIsMobile()` is true, render the 17-indicator component matrix as compact two-line list rows instead of the 6-column `<table>`. Line 1: indicator name (left) + piecewise score (right). Line 2: category badge + sparkline + signal direction pill. Drop description column. Each row tappable for `setSelectedMetric()`
- [x] 5.2 Update `web/src/components/studios/LttdLab.tsx` — when `useIsMobile()` is true, render the component table as compact two-line list rows. Line 1: component name + normalized score. Line 2: system source + signal direction. Each row minimum `56px` height with `44px` touch target
- [x] 5.3 Update `web/src/components/studios/MttdConsole.tsx` — when `useIsMobile()` is true, render the component table as compact two-line list rows with same pattern as LTTD
- [x] 5.4 Update `web/src/components/studios/IchimokuTerminal.tsx` — when `useIsMobile()` is true, render the component table as compact two-line list rows with same pattern as LTTD

## 6. MetricDetailChart Mobile Layout + Bottom Sheet Integration

- [x] 6.1 Update `web/src/components/studios/MetricDetailChart.tsx` — when `useIsMobile()` is true, change outer grid from `gridTemplateColumns: "1fr 280px"` to `gridTemplateColumns: "1fr"`. Chart panel occupies full width. Read `--chart-yaxis-width` for `rightPriceScale.minimumWidth`. Use mobile subplot heights (BTC: `160px`, Raw: `120px`, Oscillator: `120px`)
- [x] 6.2 Update `web/src/components/studios/MetricDetailChart.tsx` — when `useIsMobile()` is true, hide the inline threshold editor sidebar and render a "CONFIGURE THRESHOLDS" trigger button in the chart header. Tapping it opens the 5 threshold inputs + Save Config button inside `<BottomSheet>` in `peek` state

## 7. Touch Target and Interaction Polish

- [x] 7.1 Add mobile touch target CSS rules in `web/src/index.css` — ensure all `.icon-btn`, `.sync-btn`, category filter buttons, and chart subplot control buttons meet `min-height: 44px` / `min-width: 44px` on mobile viewports
- [x] 7.2 Set `handleScroll: { vertTouchDrag: false }` on all Lightweight Charts instances on mobile to prevent chart touch events from capturing vertical page scroll

## 8. Commit, Push, and Verify

- [ ] 8.1 Verify all views render correctly on a 375px viewport using browser DevTools device emulation — check Dashboard, Valuation Studio (composite + detail drill-down), LTTD Lab, MTTD Console, and Ichimoku Terminal
- [ ] 8.2 Verify crosshair sync still works across all stacked subplots on mobile
- [ ] 8.3 Verify threshold editor bottom sheet opens, edits, saves, and dismisses correctly on mobile
- [ ] 8.4 Verify desktop layout is completely unchanged at ≥768px viewport
- [ ] 8.5 Commit all changes with `feat(web): add mobile responsive layout with bottom tab bar, compact tables, and iOS bottom sheet` and push to `origin main`
