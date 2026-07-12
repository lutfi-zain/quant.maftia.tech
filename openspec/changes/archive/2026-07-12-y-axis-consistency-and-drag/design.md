## Context

All 4 studio components (ValuationStudio, LttdLab, MttdConsole, IchimokuTerminal) share the same chart setup pattern via `makeCommonOptions(yAxisWidth)`:

```typescript
rightPriceScale: {
  minimumWidth: yAxisWidth,  // 85 desktop, 65 mobile
  borderColor: BORDER_COLOR,
  autoScale: true,
},
handleScroll: { vertTouchDrag: false },
```

Two issues arise from this configuration:

1. **Y-axis width mismatch**: `minimumWidth` only sets a floor. When the BTC pane renders large price numbers (`$60,000+`), Lightweight Charts auto-expands the price scale to fit the labels. Oscillator subplots (`-1.0` to `+1.0`) stay at the minimum. This breaks the terminal's precise column alignment.

2. **No Y-axis drag**: `vertTouchDrag: false` explicitly disables vertical touch dragging. The `handleScale` defaults are used (no explicit config), which should enable `axisPressedMouseMove.price` — but the interaction may not work on mobile due to the explicit `vertTouchDrag: false` overriding touch behavior.

## Goals / Non-Goals

**Goals:**

- Ensure all subplot Y-axes render at the same visible width regardless of label content
- Enable Y-axis drag interaction for zoom/pan on both desktop (mouse drag) and mobile (touch drag)
- Apply changes consistently across all 4 studio components

**Non-Goals:**

- No CSS changes to `--chart-yaxis-width` variable (already 85/65)
- No changes to X-axis time scale behavior
- No crosshair or series data changes

## Decisions

**Decision 1: Enforce equal Y-axis width via post-init applyOptions**

The `minimumWidth` option in `makeCommonOptions` is already the same for all subplots. But Lightweight Charts expands beyond it for BTC's wider labels. The fix: after every chart resize and maximize event, explicitly call `priceScale("right").applyOptions({ minimumWidth: yWidth })` on every subplot — this is already done in the ResizeObserver but not in the maximize effect.

→ **Chosen:** Also apply `minimumWidth` in the maximize resize effect alongside the chart `.resize()` call. This ensures that whenever the chart dimensions change, the Y-axis width is re-locked.

**Decision 2: Use local price scale container width as a secondary lock**

As a stronger measure, after reading the computed Y-axis width, set the container div's style to the same width as the price scale's actual rendered width — forcing all subplot containers to match.

→ **Chosen:** Read the BTC price scale's `offsetWidth` after chart creation/resize, then apply it as a fixed `width` style on all subplot chart container divs. This prevents any subplot container from being wider or narrower than the BTC container.

**Decision 3: Enable vertical touch drag**

Set `handleScroll: { vertTouchDrag: true }` in `makeCommonOptions` for all studios. This enables vertical panning via touch on mobile and mouse drag on desktop.

→ **Chosen:** Change `vertTouchDrag: false` to `vertTouchDrag: true` in all 4 `makeCommonOptions` functions.

**Decision 4: Enable price axis press-move zoom**

The Lightweight Charts `handleScale.axisPressedMouseMove.price` default is `true`, so no explicit config change is needed. But we should verify it's not being overridden in any studio.

→ **Chosen:** Verify no studio explicitly sets `axisPressedMouseMove` to false. No code change needed — keep defaults.

## Risks / Trade-offs

- **[Risk] Y-axis drag conflicts with crosshair drag:** Enabling `vertTouchDrag` might interfere with the vertical crosshair movement. → **Mitigation:** The crosshair mode is `CrosshairMode.Normal` which only shows crosshair on hover, not on drag. Should not conflict.
- **[Risk] Inline width styling overrides responsive layout:** Forcing container div widths could break on resize. → **Mitigation:** Apply width in the ResizeObserver callback so it adjusts on every resize.
- **[Risk] Price label overflow with `minimumWidth`:** If `minimumWidth` is too small, BTC price labels may be clipped. → **Mitigation:** Use the CSS variable value (85 desktop, 65 mobile) which already accounts for typical label widths at 11px mono font.
