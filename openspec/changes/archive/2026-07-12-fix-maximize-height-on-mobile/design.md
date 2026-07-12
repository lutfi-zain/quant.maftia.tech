## Context

The 4 studio components (ValuationStudio, LttdLab, MttdConsole, IchimokuTerminal) each define a `getPanelHeights(maximized, isMobile)` function that computes chart subplot heights. These functions share an identical pattern:

1. On desktop: returns fixed pixel heights (`{ btc: 280-320, ... }`) or full viewport height when maximized.
2. On mobile when maximized: sets the primary panel height to `full = window.visualViewport?.height || window.innerHeight`.

The mobile layout wraps all studio content in `AppLayout`, which renders a `<BottomTabBar />` below the main content area. The bottom tab bar is 56px tall and is always visible — even when a chart panel is maximized, because the `chart-fullscreen-active` class only hides siblings within the studio container, not ancestors.

The CSS already compensates for this:

```css
@media (max-width: 768px) {
  .chart-panel.fullscreen {
    bottom: 56px;
    height: calc(100dvh - 56px) !important;
  }
}
```

However, the JavaScript `getPanelHeights()` does not — it passes `full` (the entire viewport) to `btc.resize(w, full)`, telling Lightweight Charts to render a canvas that's 56px taller than the actual displayed container. This causes a canvas-to-container dimension mismatch.

## Goals / Non-Goals

**Goals:**

- Fix maximized chart panel heights on mobile so the Lightweight Charts canvas dimensions match the actual CSS container (`calc(100dvh - 56px)`)
- Fix semi-maximized states (65/35 splits) on mobile to account for the bottom tab bar
- Apply the fix to all 4 studio components consistently
- Introduce a shared constant for the mobile bottom tab height to eliminate magic numbers
- Keep desktop behavior unchanged

**Non-Goals:**

- No CSS changes — the current `chart-panel.fullscreen` rules are correct
- No changes to the app layout or bottom tab bar component
- No changes to desktop maximize behavior
- No changes to MetricDetailChart (which doesn't have per-panel maximize)

## Decisions

**Decision 1: Use a shared constant instead of inline magic numbers**

Each `getPanelHeights()` currently has no imports or shared utilities. Rather than duplicating `56` across 4 files, define a constant near the function or extract to a shared utility if the pattern repeats.

→ **Chosen: Define `MOBILE_BOTTOM_TAB_HEIGHT = 56` as a local `const` at the top of each studio file (near the `getPanelHeights` function).** This keeps the change minimal per file and avoids introducing a new shared module for a single constant. If more shared chart utilities emerge later, they can be extracted together.

**Decision 2: Account for semi-maximize states**

When a secondary panel is maximized (e.g., `"hmm"`, `"imo"`, `"val"`, `"scomp"`, `"gates"`, `"vol"`), the BTC panel still shows at 65% and the secondary at 35%. On mobile, these percentages should be calculated against the available height (viewport − 56px) rather than the full viewport.

→ **Chosen: Compute `available = full - MOBILE_BOTTOM_TAB_HEIGHT` when `isMobile`, then use `available` instead of `full` for all maximize calculations.** This ensures all panel sizing is consistent.

**Decision 3: Handle the default (non-maximized) mobile heights**

The default mobile heights (`{ btc: 160, ... }`) are intentionally small previews and don't overflow because they don't use `full`. They don't need adjustment.

→ **No change needed for default mobile heights.**

**Decision 4: VisualViewport vs innerHeight**

The current code prefers `window.visualViewport?.height` with a fallback to `window.innerHeight`. On mobile Safari, `visualViewport.height` changes when the address bar hides/shows. The 56px bottom tab correction should be applied after the viewport height is resolved.

→ **Chosen: Keep the existing resolution logic (`window.visualViewport?.height || window.innerHeight`) unchanged. Apply the bottom tab subtraction as a separate step on mobile.**

**Alternatives considered:**

- **CSS-only fix:** Could add `overflow: hidden` to clip the excess, but this would still leave the Lightweight Charts canvas at wrong internal dimensions, breaking crosshair accuracy, price scale rendering, and hover interactions.
- **Reading the bottom tab bar's actual offsetHeight at runtime:** More robust against future layout changes. Rejected because it couples chart logic to DOM structure and introduces a timing dependency. A static constant aligned with the CSS constant is simpler and sufficient.

## Risks / Trade-offs

- **[Risk] Static constant drift:** If the bottom tab bar height changes in CSS without updating the JS constant, the mismatch returns. → **Mitigation:** Add a comment next to the CSS rule and the JS constant cross-referencing each other.
- **[Risk] Future mobile chrome additions:** If a mobile header or other fixed element is added to the layout, more heights would need to be subtracted. → **Mitigation:** The constant approach makes it easy to add more subtractions; a future header would just be `full - TAB_BAR - HEADER`.
- **[Trade-off] Code duplication:** Defining the constant in 4 files instead of 1 shared module. Acceptable for now given the small scope — if more chart utilities are shared later, they can be extracted.
- **[Trade-off] Visual regression on desktop:** The fix only applies when `isMobile` is true, so desktop is completely unaffected.
