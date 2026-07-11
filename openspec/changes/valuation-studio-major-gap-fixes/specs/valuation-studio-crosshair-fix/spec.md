## ADDED Requirements

### Requirement: Crosshair Y-position resolved from data map
For every chart panel in the Valuation Studio (composite BTC, composite valuation, detail BTC, detail raw, detail oscillator), the crosshair sync mechanism SHALL resolve the actual data value at the hovered time point before calling `setCrosshairPosition`, so the horizontal crosshair line appears at the correct Y coordinate on all synced panels.

#### Scenario: Crosshair hover on composite BTC panel syncs correct Y on valuation panel
- **WHEN** the user hovers over the composite BTC candlestick panel at a specific date
- **THEN** `setCrosshairPosition(valuationScore, time, valuationSeries)` is called with the actual `ValuationComposite` score for that date (not `0`)
- **AND** the horizontal crosshair line on the valuation panel is positioned at the correct score level

#### Scenario: Crosshair hover on composite valuation panel syncs correct Y on BTC panel
- **WHEN** the user hovers over the composite valuation panel at a specific date
- **THEN** `setCrosshairPosition(closePrice, time, btcSeries)` is called with the actual BTC close price for that date
- **AND** the horizontal crosshair line on the BTC panel is positioned at the correct price level

#### Scenario: Crosshair hover on detail oscillator panel syncs all 3 detail panels
- **WHEN** the user hovers over the detail oscillator panel
- **THEN** all 3 detail panels (BTC, raw metric, oscillator) receive `setCrosshairPosition` calls with actual data values for that date
- **AND** no panel shows the crosshair at Y=0 unless the actual data value is 0

#### Scenario: No data at hovered time point
- **WHEN** the user hovers at a time point where a panel has no data (e.g., gap day)
- **THEN** `setCrosshairPosition` is not called for that panel (graceful skip)

### Requirement: Data maps built at chart initialization
Each chart panel's `dataMap: Map<string, number>` SHALL be built at initialization time (inside the `useEffect` that sets chart series data) mapping ISO date strings to the panel's primary Y value, so O(1) lookup is possible during every `subscribeCrosshairMove` callback.

#### Scenario: Data map is rebuilt after data refresh
- **WHEN** chart data is refreshed (e.g., user navigates to a new metric)
- **THEN** the `dataMap` for each panel is rebuilt to reflect the new dataset
- **AND** crosshair sync immediately uses the updated values
