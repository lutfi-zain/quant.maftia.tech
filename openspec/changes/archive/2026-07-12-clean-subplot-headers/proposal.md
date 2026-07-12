## Why

Subplot headers across all 4 studio views are cluttered with redundant secondary information. Each header shows:

1. A title (badge + name) — essential for identification
2. A subtitle (`.subplot-meta`) — e.g., "BTC / USD · DAILY", "LOG RETURN BASIS", "RANGE [-2.00, +2.00]"
3. An axis lock badge (`.subplot-axis-lock`) — showing "85px"
4. A maximize button — functional

The subtitle text and 85px badge add visual noise without actionable value. The subtitle info is already implied by the chart content, and the 85px Y-axis width is an internal implementation detail that end-users don't need to see. On mobile, this clutter forces the header into a 2-row layout consuming 48px of vertical space.

Removing these elements simplifies the headers, reduces visual noise, and on mobile allows the header to collapse back to a single row for more chart area.

## What Changes

- Remove `.subplot-meta` span elements from all subplot headers across all 4 studios
- Remove `.subplot-axis-lock` span elements (the "85px" badge) from all subplot headers
- Keep `.subplot-title` (badge + name) and the maximize icon button
- Update mobile CSS to collapse the header back to a single row (removing the 2-row layout since controls are now minimal)

## Capabilities

### New Capabilities

- `clean-subplot-headers`: Remove redundant subtitle text and axis lock badge from all subplot headers across Valuation, LTTD, MTTD, and Ichimoku studios, simplifying to just title and maximize button.

### Modified Capabilities
<!-- No existing specs to modify — this is a UI cleanup, not a spec-level requirement change. -->

## Impact

### Affected Files

- `web/src/components/studios/ValuationStudio.tsx` — remove `.subplot-meta` and `.subplot-axis-lock` from BTC and VAL subplot headers
- `web/src/components/studios/LttdLab.tsx` — same for BTC, HMM, VOL subplot headers
- `web/src/components/studios/MttdConsole.tsx` — same for BTC, IMO, GATES subplot headers
- `web/src/components/studios/IchimokuTerminal.tsx` — same for BTC, IMO, SCOMP subplot headers
- `web/src/index.css` — simplify mobile subplot header CSS (remove 2-row layout)

### Non-goals

- No changes to the chart rendering, data, or interaction behavior
- No changes to the `.subplot-title` badge or title text
- No changes to the maximize button functionality or positioning
- The Y-axis 85px lock is still enforced in the chart options — only the visual badge is removed
