## Context

The SDCA Panel in Valuation Studio currently displays hardcoded threshold presets. When a user selects a preset, the frontend calls `POST /api/v1/sdca/backtest` with the preset's threshold values and displays the result. However, there is no way for users to manually adjust individual thresholds (DCA In Start, All In Val, DCA Out Start, All Out Val) and trigger a recalculate.

The backend already supports custom thresholds via the `POST /api/v1/sdca/backtest` endpoint, which passes `body.thresholds` to `computeSdcaBacktest()`. The `sdcaEngine.ts` `validateThresholds()` function validates all threshold parameters. So the backend is ready — only the frontend wiring is missing.

## Goals / Non-Goals

**Goals:**

- Add 4 slider inputs to the SDCA Panel for the 4 hysteresis thresholds
- When a slider changes, debounce and call `POST /api/v1/sdca/recalculate` with the new thresholds
- Update the displayed backtest metrics and trade log with the recomputed results
- Save custom thresholds to `localStorage` so they persist across sessions
- Allow resetting to any built-in preset to revert custom changes

**Non-Goals:**

- Changing the existing 4 presets (Optimized, High Sharpe, Max Yield, Conservative)
- Adding server-side persistence
- Modifying the Python SDCA engine

## Decisions

### Decision 1: Frontend Data Flow

```
Slider Change → debounce 500ms → POST /api/v1/sdca/recalculate
  → Backend runs computeSdcaBacktest(newThresholds)
  → Returns { metrics, equity_curve, trade_log, signals }
  → Frontend updates all display panels
```

### Decision 2: API Endpoint

Reuse `POST /api/v1/sdca/backtest` with the custom thresholds. No new endpoint needed — the existing endpoint already accepts `body.thresholds`. The frontend will pass:

```json
{
  "thresholds": {
    "dca_in_start": 1.8,
    "all_in_val": 1.5,
    "dca_out_start": -1.5,
    "all_out_val": 0.0
  }
}
```

### Decision 3: UI Layout

Add a collapsible "Threshold Configuration" section below the presets in SdcaPanel:

```
[Preset Selector: ▼ Optimized]
[▼ Threshold Configuration]
  DCA In Start [==========o========] +1.80
  All In Val   [======o============] +1.50
  DCA Out Start[==========o========] -1.50
  All Out Val  [========o==========] 0.00
  [Recalculate]
```

### Decision 4: Validation

Apply the same validation rules as `validateThresholds()` in `sdcaEngine.ts`:

- `all_in_val` must be <= `dca_in_start`
- `all_out_val` must be >= `dca_out_start`
- All values clamped to their defined ranges

If validation fails, disable the Recalculate button and show a tooltip.

### Decision 5: localStorage

Store custom thresholds as a JSON key `sdca_custom_thresholds`. On component mount, check for this key first, then fall back to the selected preset.

## Risks / Trade-offs

- **500ms debounce**: Prevents excessive API calls while sliding, but may feel slightly laggy. 300ms may be better for responsive feel.
- **Recalculate vs. full backtest**: The existing `POST /api/v1/sdca/backtest` runs the full backtest every time. For large date ranges (2010-present), this could take 2-5 seconds. Consider showing a loading spinner.
- **No server-side persist**: Custom thresholds are lost if `localStorage` is cleared. Acceptable for now — presets provide safe defaults.
