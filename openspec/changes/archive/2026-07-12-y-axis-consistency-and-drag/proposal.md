## Why

Two chart interaction issues in all 4 studio views (Valuation, LTTD, MTTD, Ichimoku):

1. **Y-axis widths differ between BTC and subplot panes**: The BTC candlestick pane displays large price numbers (`$60,000+`) while oscillator subplots show small decimal values (`-1.0` to `+1.0`). Lightweight Charts auto-expands the price scale beyond the `minimumWidth: 85px` (or `65px` on mobile) to fit the wider BTC price labels, while subplot scales stay at the minimum. This creates visually mismatched axis widths that break the terminal's precision layout.

2. **Y-axis cannot be dragged for zoom/pan**: The X-axis (time scale) supports click-drag for panning and zooming, but the Y-axis (price scale) does not respond to drag gestures. Users expect both axes to support similar interaction — dragging on the Y-axis should vertically zoom (via `axisPressedMouseMove.price`) or pan (via `vertTouchDrag`).

## What Changes

- Lock the right price scale width to the same pixel value for ALL subplots by enforcing a fixed width (not just `minimumWidth`) after each chart initialization and resize. This prevents BTC's wider price labels from expanding its axis beyond the subplot axes.
- Apply the same width lock on both desktop (`85px`) and mobile (`65px` from CSS variable `--chart-yaxis-width`).
- Enable Y-axis drag interaction by setting `handleScroll.vertTouchDrag = true` and ensuring `handleScale.axisPressedMouseMove.price` is enabled.

## Capabilities

### New Capabilities

- `y-axis-width-lock`: Force all subplot Y-axes (BTC + oscillator/indicator) to use the same exact pixel width by applying a fixed width after every chart resize, preventing price label expansion from breaking visual alignment.
- `y-axis-drag-zoom`: Enable vertical drag/scroll interaction on the Y-axis (price scale) for zooming and panning, matching the X-axis interaction behaviour.

### Modified Capabilities
<!-- No existing specs to modify — this is a new behavioural change. -->

## Impact

### Affected Files

- `web/src/components/studios/ValuationStudio.tsx` — chart init, resize effect, priceScale options
- `web/src/components/studios/LttdLab.tsx` — chart init, resize effect, priceScale options
- `web/src/components/studios/MttdConsole.tsx` — chart init, resize effect, priceScale options
- `web/src/components/studios/IchimokuTerminal.tsx` — chart init, resize effect, priceScale options

### Non-goals

- No changes to the CSS `--chart-yaxis-width` variable (already correct at `85px` desktop, `65px` mobile).
- No changes to the X-axis (time scale) behaviour.
- No changes to crosshair or other chart interactions.
