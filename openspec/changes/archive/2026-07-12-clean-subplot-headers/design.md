## Context

Each subplot header in all 4 studios has this HTML structure:

```html
<div class="chart-subplot-header">
  <div class="subplot-title">
    <span class="subplot-badge">SYS 01</span>
    <span>Chart Title</span>
  </div>
  <div class="subplot-controls">
    <span class="subplot-meta">SUBTITLE TEXT</span>       <!-- to remove -->
    <span class="subplot-axis-lock">85px</span>            <!-- to remove -->
    <button class="icon-btn">maximize</button>             <!-- keep -->
  </div>
</div>
```

On **desktop**, the header is a single flex row: title on left, controls on right.
On **mobile**, CSS forces a 2-row layout: title row + controls row (with dashed border), `min-height: 48px`.

The `.subplot-meta` shows context like "LOG RETURN BASIS", "BTC / USD · DAILY" — information already obvious from the chart content. The `.subplot-axis-lock` "85px" badge is an implementation detail. Removing both reduces clutter and recovers vertical space on mobile.

## Goals / Non-Goals

**Goals:**

- Remove `.subplot-meta` and `.subplot-axis-lock` from all subplot headers in all 4 studios
- Simplify mobile subplot header CSS back to a single compact row
- Keep `.subplot-title` badge/title and the maximize button

**Non-Goals:**

- No changes to chart rendering, data, or interactions
- No changes to the actual Y-axis width enforcement (the 85px lock remains in chart options)
- No changes to badge styling or title text

## Decisions

**Decision 1: Remove the meta and axis-lock elements from JSX**

Each studio's subplot header JSX has the `.subplot-meta` and `.subplot-axis-lock` spans inline. These will be removed directly from the JSX in all 12 subplot headers across 4 studios.

→ **Chosen:** Direct removal from JSX. The `.subplot-controls` div will contain only the maximize button after cleanup.

**Decision 2: Simplify mobile header CSS**

With only the maximize button remaining in `.subplot-controls`, the header no longer needs the 2-row column layout. The CSS can revert to a single-row flex layout (`flex-direction: row`, standard height).

→ **Chosen:** Update mobile `.chart-subplot-header` to `flex-direction: row`, `align-items: center`, `height: 30px`, `min-height: unset`. Remove `.subplot-controls` border-top styling. The `.subplot-meta` CSS block can be kept (no harm if the element is removed from JSX).

## Risks / Trade-offs

- **[Trade-off] Lost informational context:** Subtitle text provided quick reference for what each pane shows. → **Mitigation:** The title (badge + name) and chart content itself already convey this information.
- **[Trade-off] Missing 85px reference:** The axis lock badge told developers/debuggers the Y-axis width. → **Mitigation:** The `--chart-yaxis-width` CSS variable and chart priceScale options still enforce the lock. The visual badge is redundant.
