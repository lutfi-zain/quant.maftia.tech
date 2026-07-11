# valuation-studio-loading-error-states Specification

## Purpose
TBD - created by archiving change valuation-studio-major-gap-fixes. Update Purpose after archive.
## Requirements
### Requirement: Loading state displayed during initial data fetch
`ValuationStudio.tsx` SHALL display a centered loading spinner overlay while the initial data fetch is in progress, so users are not presented with an empty or partial chart.

#### Scenario: Spinner visible during data fetch
- **WHEN** the Valuation Studio mounts and the API call to fetch composite data is in flight
- **THEN** a loading spinner overlay is displayed over the chart area
- **AND** the chart panels are not interactable during loading

#### Scenario: Spinner hidden after successful data load
- **WHEN** the API call completes successfully and chart data is set
- **THEN** the loading spinner is hidden and the chart panels become interactive

#### Scenario: Spinner hidden on error
- **WHEN** the API call fails
- **THEN** the loading spinner is replaced by the error state UI (not left spinning)

### Requirement: Error state with retry shown on API failure
`ValuationStudio.tsx` SHALL display an error panel with a descriptive message and a `Retry` button when the initial data fetch fails (network error, HTTP 4xx/5xx, or parse error).

#### Scenario: Error panel shown on fetch failure
- **WHEN** the initial composite data fetch returns an HTTP error or throws
- **THEN** an error panel is displayed with a short error message (e.g., "Failed to load valuation data")
- **AND** a `Retry` button is visible

#### Scenario: Retry button re-triggers the data fetch
- **WHEN** the user clicks the `Retry` button
- **THEN** the loading spinner appears again
- **AND** the data fetch is re-attempted from the API

#### Scenario: Successful retry clears error state
- **WHEN** a retry fetch succeeds
- **THEN** the error panel is hidden and the chart renders normally

