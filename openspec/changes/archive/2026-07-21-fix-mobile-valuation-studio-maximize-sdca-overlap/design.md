## Context

In the Valuation Studio (`ValuationStudio.tsx`), the user can maximize individual chart subplots (BTC Price, Valuation Composite, or Equity Curve). When a subplot is maximized, the parent container class transitions to `.chart-fullscreen-active`.

The global CSS (in `index.css`) contains rules to manage this maximized state:

- `.chart-fullscreen-active > *:not(.chart-panel) { display: none !important; }` (hides any element that is not a chart panel)
- `.chart-fullscreen-active .chart-panel:not(.fullscreen) { display: none !important; }` (hides any chart panel that does not have the `.fullscreen` class)

The `SdcaPanel` component uses the `.chart-panel` class name for styling purposes. However, `ValuationStudio.tsx` currently passes the prop `fullscreen={maximized !== null}` to `SdcaPanel`. This causes the `SdcaPanel` to receive the `.fullscreen` class when a chart is maximized. As a result, it is not hidden by the CSS rules. Instead, it gets styled with `position: fixed; z-index: 9999`, covering the entire viewport and obscuring the maximized chart.

## Goals / Non-Goals

**Goals:**

- Prevent the `SdcaPanel` from receiving the `.fullscreen` class when a chart subplot is maximized in the Valuation Studio.
- Ensure the `SdcaPanel` is automatically hidden by existing CSS rules (`.chart-panel:not(.fullscreen)`) when a chart is maximized.
- Completely remove the unused and problematic `fullscreen` prop from the `SdcaPanel` component and its parent usages.

**Non-Goals:**

- Redesigning the `SdcaPanel` layout or styling.
- Adding custom visibility toggle state in React for the panel. We will rely entirely on the established CSS layout rules.

## Decisions

### Decision 1: Remove the `fullscreen` prop and rely on CSS visibility rules

- **Chosen:** Remove the `fullscreen` prop from both `ValuationStudio.tsx` (the parent usage) and `SdcaPanel.tsx` (the component definition).
- **Alternative considered:** Keep the prop but pass `fullscreen={false}` in `ValuationStudio.tsx`. Rejected because the prop is dead code and is never used for any purpose other than applying the problematic `.fullscreen` class.
- **Rationale:** Removing the prop completely simplifies the component API, prevents future developers from accidentally re-enabling it, and allows the existing CSS rules (`.chart-panel:not(.fullscreen)`) to naturally hide the panel when `.chart-fullscreen-active` is present on the parent.

## Risks / Trade-offs

- **[Risk]** The panel might remain visible if the `.chart-fullscreen-active` class is not correctly applied.
  - **Mitigation:** We verified that `ValuationStudio.tsx` correctly sets `className={maximized !== null ? "chart-fullscreen-active" : ""}` on the parent container. No further changes to container classes are required.
