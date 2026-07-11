## Context

The frontend SPA (`/web`) is a React 19 + Vite + TypeScript single-page financial terminal built exclusively for desktop viewports. The layout uses a fixed 260px sidebar (`position: fixed`) with the main content area offset by `margin-left: 260px` and padded at `24px 32px`. All studio component tables render as 6-7 column `<table>` elements. Chart panels rely on ResizeObserver for width but assume generous horizontal space. There are zero `@media` queries or responsive breakpoints in the entire codebase.

The codebase uses vanilla CSS in `web/src/index.css` with CSS custom properties for the design token system. Component styling is a mix of CSS classes (`.glass-card`, `.chart-panel`, `.chart-subplot`) and inline React styles. Lightweight Charts v5.2 handles canvas rendering with a strict 85px right Y-axis width lock (`minimumWidth: 85`) across all subplots.

## Goals / Non-Goals

**Goals:**
- Make all 5 views (Dashboard, Valuation Studio, LTTD Lab, MTTD Console, Ichimoku Terminal) fully usable on phone screens (375px–430px)
- Preserve the desktop experience exactly as-is for viewports ≥768px
- Enable deep-dive studio interactions on mobile (chart drill-downs, threshold editing, maximize/restore)
- Maintain crosshair sync, chart panel maximize, and PNG export functionality on mobile

**Non-Goals:**
- PWA, service worker, or offline support
- Tablet-specific breakpoints (768px+ is treated as desktop)
- Touch gesture navigation between studios (swipe-to-switch)
- Native mobile app
- Any backend, API, or data pipeline changes

## Decisions

### Decision 1: Single Breakpoint at 768px

**Choice:** One breakpoint — `@media (max-width: 767px)` — for all mobile adaptations.

**Alternatives considered:**
- Multi-breakpoint (480/768/1024): Adds complexity without proportional value. The sidebar layout works fine from 768px up. Below 768px, everything needs to change regardless.
- Container queries: More granular but browser support is less mature and the component structure doesn't benefit from it — the transformations are page-level, not component-level.

**Rationale:** The terminal is either wide enough for the sidebar (≥768px) or it isn't. A single clean cut keeps the CSS maintainable and the React logic simple (one `useMediaQuery(767)` hook).

### Decision 2: Bottom Tab Bar + Hamburger Drawer (Not Just Hamburger)

**Choice:** Fixed bottom tab bar with 5 navigation icons (Dashboard, Valuation, LTTD, MTTD, Ichimoku) permanently visible. Secondary sidebar content (data range, gateway status, brand header) accessible via hamburger menu that opens a slide-over drawer from the left.

**Alternatives considered:**
- Hamburger-only: Hides all navigation behind a tap. Bad for a 5-view app where switching is frequent.
- Top tab bar: Competes with the sticky header for vertical space. Bottom is thumb-reachable.
- Swipeable tabs: More complex, risk of interfering with chart touch interactions (pinch-zoom, pan).

**Rationale:** The 5 studios are the primary navigation. They should be one-tap accessible at all times. The bottom tab bar pattern is universally understood from iOS/Android. Secondary info (data range, gateway status) is lower priority and fits naturally in a drawer.

### Decision 3: Compact Two-Line List for Tables

**Choice:** Transform `<table>` elements into a vertical list of compact two-line rows on mobile. Line 1: indicator name (left-aligned) + piecewise score (right-aligned). Line 2: category badge + sparkline + signal direction pill. Description column dropped entirely.

**Alternatives considered:**
- Horizontal scroll wrapper: Technically easiest but terrible UX — user can't see name and score simultaneously.
- Card layout (one card per metric): Takes too much vertical space for 17 indicators. Scanning becomes painful.
- Responsive table with hidden columns: Complex CSS, doesn't solve the fundamental width problem.

**Rationale:** The compact list preserves the most critical data (name, score, direction, trend sparkline) while fitting within 375px. Description text is reference documentation — it has no action value on mobile. Each row remains tappable for drill-down into the 3-panel detail chart.

### Decision 4: 65px Y-Axis on Mobile

**Choice:** Reduce `rightPriceScale.minimumWidth` from 85px to 65px on screens `<768px`.

**Alternatives considered:**
- Keep 85px everywhere: On a 375px screen, 85px leaves only 290px of plot area. Candlestick wicks become hard to distinguish.
- Remove Y-axis labels: Too aggressive — users need price/oscillator reference values.
- 50px: Too tight for 5-digit BTC prices even with `precision: 0`.

**Rationale:** With `precision: 0` on BTC prices, the widest label is ~5 characters ("99999"). At 65px with JetBrains Mono at 11px, this fits. This gives 310px of plot area — a 7% improvement that makes a meaningful difference for candlestick readability. The 85px rule remains enforced on desktop; this is a mobile-only relaxation.

**Implementation:** A CSS custom property `--chart-yaxis-width` set to `85px` by default, overridden to `65px` inside the `@media (max-width: 767px)` block. Chart initialization code reads this value via `getComputedStyle()`.

### Decision 5: iOS-Style Bottom Sheet for Threshold Editor

**Choice:** Build a reusable `<BottomSheet>` component. On mobile, the threshold editor renders inside a bottom sheet that slides up from the screen bottom with a drag handle, backdrop overlay, and drag-to-dismiss.

**Alternatives considered:**
- Collapsible accordion below charts: Takes vertical space even when collapsed (the header bar). Doesn't feel native on mobile.
- Full-screen modal: Too heavy for 5 input fields. Loses chart context.
- Inline below charts (always visible): Pushes charts above the fold. User has to scroll up to see chart after editing thresholds.

**Rationale:** Bottom sheets are the standard iOS/Android pattern for contextual controls. The user can see the charts while the sheet is partially open, adjust thresholds, and see chart updates in real-time. Drag-to-dismiss is intuitive. The component is reusable if other studios need similar controls later.

**Implementation details:**
- Three states: `closed`, `peek` (40% viewport height), `expanded` (80% viewport height)
- Drag handle at top, backdrop with `rgba(0,0,0,0.5)` that dismisses on tap
- CSS `transform: translateY()` with `transition: transform 0.3s ease` for smooth animation
- Touch event handling: `touchstart`/`touchmove`/`touchend` for drag gesture
- Renders inside a React portal to escape parent overflow/z-index stacking contexts

### Decision 6: CSS-First Approach with Minimal React Branching

**Choice:** Implement responsive adaptations primarily through CSS `@media` queries in `index.css`, with React conditional rendering only where the DOM structure must fundamentally change (table → list, sidebar → bottom tab bar).

**Alternatives considered:**
- Full React conditional rendering (`isMobile ? <MobileLayout> : <DesktopLayout>`): Doubles the JSX, creates maintenance burden of keeping two layouts in sync.
- CSS-only with no DOM changes: Can't transform a `<table>` into a compact list with pure CSS without accessibility issues.

**Rationale:** CSS handles visibility, padding, grid columns, and sizing changes cleanly. React handles structural changes (different components for navigation, different markup for data display). This keeps the delta small and avoids forking entire studio files.

**New React hook:** `useIsMobile(): boolean` — wraps `window.matchMedia('(max-width: 767px)')` with a `change` event listener. Used in components that need structural DOM changes.

### Decision 7: Chart Height Scaling

**Choice:** Reduce stacked subplot heights on mobile: BTC candlestick 160px (from 220px), secondary panes 120px (from 160-180px).

**Rationale:** On a phone, the visible viewport after the sticky header (56px) and bottom tab bar (56px) is ~600px. Three subplots at desktop heights (220+180+160 = 560px) would fill the entire viewport leaving no room for subplot headers or scroll. At 160+120+120 = 400px, the chart stack fits with room for headers and the user can scroll to tables below.

## Risks / Trade-offs

- **[Lightweight Charts touch pan vs page scroll]** → Lightweight Charts v5.2 captures touch events for pinch-zoom and horizontal pan. This can conflict with vertical page scrolling. Mitigation: charts are in a fixed-height container, so vertical scroll only applies outside the chart area. If issues arise, set `handleScroll: { vertTouchDrag: false }` on chart options.

- **[Sparkline touch targets in compact list]** → Sparklines are 80×24px SVGs. On mobile they may be too small to show hover tooltips. Mitigation: On mobile, the sparkline tooltip is triggered on tap (not hover) and positioned above the finger, not under it.

- **[Bottom sheet z-index conflicts]** → The bottom sheet needs `z-index: 1000+` to overlay charts. If a chart panel is maximized (`z-index: 9999`), the bottom sheet must stack above it. Mitigation: bottom sheet portal renders with `z-index: 10000`.

- **[Performance on low-end phones]** → Four studios with Lightweight Charts canvas rendering. Mitigation: charts are only initialized when the studio tab is active (existing behavior), so only one studio's charts are in memory at a time.

## Open Questions

- Should the mobile compact list support long-press for a quick-peek popover (showing description + current raw value) without navigating to the full detail view? This could be a future enhancement.
