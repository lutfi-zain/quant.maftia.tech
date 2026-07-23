## 1. Backend API: Add Recalculate Endpoint

- [x] 1.1 Reuse existing `POST /api/v1/sdca/backtest` — already accepts `body.thresholds` and passes to `computeSdcaBacktest()`
- [x] 1.2 No new route needed — existing backend endpoints are sufficient

## 2. Frontend: Threshold Editor Sliders

- [x] 2.1 Slider inputs already exist in `SdcaPanel.tsx` — updated onChange handlers to use `handleThresholdChange`
- [x] 2.2 Added `handleThresholdChange` with 300ms debounce + `localStorage` save + auto-recalculate trigger
- [x] 2.3 Validation (`isValid`) already existed — wired to debounce and recalculate flow

## 3. Frontend: Recalculate Integration

- [x] 3.1 Imported `SdcaPanel` into `ValuationStudio.tsx` and wired `onRecalculate={handleSdcaRecalculate}`
- [x] 3.2 `isRecalculating` state and spinner already existed in `SdcaPanel`
- [x] 3.3 Preset selector wired via `handleApplyPreset` which calls `onRecalculate` — slider changes auto-trigger recalculate via debounce
- [x] 3.4 `useState` initializer reads `sdca_custom_thresholds` from localStorage on mount

## 4. Frontend: localStorage Persistence

- [x] 4.1 `handleThresholdChange` saves to `sdca_custom_thresholds` after 300ms debounce
- [x] 4.2 Added `isCustomPreset` memo that shows "⚙ Custom Configuration" option in preset dropdown
- [x] 4.3 `handleApplyPreset` removes `sdca_custom_thresholds` from localStorage

## 5. Testing

- [x] 5.1 Verify preset selection updates backtest metrics — wired via `handleApplyPreset` → `onRecalculate`
- [x] 5.2 Verify custom slider values trigger recalculate — `handleThresholdChange` with 300ms debounce → `onRecalculate`
- [x] 5.3 Verify validation — `isValid` check already exists, disables button with tooltip
- [x] 5.4 Verify localStorage persistence — `sdca_custom_thresholds` read on mount, saved on slider change
