# chart-png-export Specification

## Purpose
TBD - created by archiving change valuation-studio-parity-with-prior-system. Update Purpose after archive.
## Requirements
### Requirement: PNG Export of Active Chart View

The Valuation Studio SHALL provide a "SAVE PNG" button that exports the currently visible chart view (either the main composite 2-panel chart or the 3-panel metric detail chart) as a single merged PNG image.

#### Scenario: Export composite chart view

- **WHEN** a user clicks "SAVE PNG" while the main composite chart (BTC Candlestick + Valuation Composite) is visible
- **THEN** the system SHALL composite all chart canvases into a single PNG with a dark background (`#0B1220`), draw all subplot canvases at their correct vertical offsets, add a branding watermark at the bottom ("QUANT UNIFIED PLATFORM // VALUATION"), and trigger a browser download of the PNG file

#### Scenario: Export metric detail chart view

- **WHEN** a user clicks "SAVE PNG" while the 3-panel metric detail chart is visible
- **THEN** the system SHALL composite the 3 subplot canvases (BTC OHLC, Raw Metric, Oscillator) into a single PNG with the same branding format and trigger a download

#### Scenario: PNG file naming

- **WHEN** a PNG export is triggered
- **THEN** the downloaded file MUST be named with the pattern `btc-valuation-{date}.png` for composite view or `btc-valuation-{metric_name}-{date}.png` for metric detail view, where `{date}` is the current date in `YYYY-MM-DD` format

### Requirement: High-DPI Canvas Compositing

The PNG export SHALL use `window.devicePixelRatio` to produce high-resolution output on Retina/HiDPI displays. The merged canvas dimensions MUST be multiplied by `devicePixelRatio` while keeping CSS dimensions at 1x.

#### Scenario: Retina display export quality

- **WHEN** a user exports a PNG on a device with `devicePixelRatio === 2`
- **THEN** the output PNG MUST be 2x the CSS pixel dimensions, ensuring sharp text and lines on high-DPI screens

### Requirement: Chart Footer Watermark

Every exported PNG SHALL include a footer watermark area (40px height) containing the system name on the left and the export date on the right, rendered in monospace font on the dark background.

#### Scenario: Watermark content

- **WHEN** a PNG is exported
- **THEN** the footer MUST display "QUANT UNIFIED PLATFORM // VALUATION" on the left and "DATE: YYYY-MM-DD" on the right in `#64748B` monospace text

