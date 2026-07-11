## ADDED Requirements

### Requirement: PNG export includes 16px gap between subplot canvases
The `exportChartsToPng` utility SHALL add a 16px vertical gap between each subplot canvas when compositing the final export image, matching the visual gap between chart panels in the UI.

#### Scenario: Exported PNG shows visible gap between BTC and oscillator panels
- **WHEN** the user clicks the PNG export button in Valuation Studio
- **THEN** the exported PNG shows a 16px gap between the BTC candlestick section and the valuation oscillator section
- **AND** the gap is not filled with chart content from either panel

#### Scenario: Total canvas height accounts for gaps
- **WHEN** the compositing canvas is created
- **THEN** its total height is `sum(panel heights) + (num_panels - 1) * 16`
