# mobile-data-tables Specification

## Purpose
Defines normative requirements for transforming the 6-7 column desktop component breakdown `<table>` elements across all 4 quantitative studios into touch-friendly, compact two-line list layouts on mobile viewports (`<768px`).

## ADDED Requirements

### Requirement: Compact Two-Line List Layout for Studio Component Tables
When running on mobile viewports (`<768px`), each of the 4 quantitative studio views (`ValuationStudio`, `LttdLab`, `MttdConsole`, and `IchimokuTerminal`) SHALL render their multi-column component breakdown metrics (`UnifiedComponentSignals`) using a compact two-line list layout instead of the standard desktop `<table>` grid (`6-7 columns`).

#### Scenario: Rendering Valuation Studio component rows on mobile
- **WHEN** `ValuationStudio` mounts on a mobile viewport (`<768px`)
- **THEN** instead of rendering the 6-column `<table>` (`Indicator Name`, `Category`, `Description`, `Trend`, `Piecewise Score`, `Signal Direction`), the studio MUST render a vertical list of rows where:
  - Line 1 displays `Indicator Name` (left-aligned, `font-weight: 600`) and `Piecewise Score [-2, +2]` (right-aligned, `font-family: JetBrains Mono`)
  - Line 2 displays the `Category` badge (`Fundamental`/`Technical`/`Sentiment`), a mini 90-day `Sparkline` SVG, and the `Signal Direction` status pill (`OVERVALUED (+1)` / `DISCOUNT (-1)` / `NEUTRAL (0)`)
  - The `Description` text column is dropped entirely on mobile to save horizontal space

#### Scenario: Rendering LTTD, MTTD, and Ichimoku component rows on mobile
- **WHEN** `LttdLab`, `MttdConsole`, or `IchimokuTerminal` mount on a mobile viewport (`<768px`)
- **THEN** their respective 7-column component tables MUST render as compact two-line list cards containing the component name, normalized score (`[-1.0, +1.0]`), signal direction indicator, and category family without horizontal table clipping

### Requirement: Tappable Drill-Down Navigation on Mobile List Rows
Every compact two-line list row in the mobile studio views SHALL provide a minimum touch target height of `56px` (`padding: 12px 8px`) and remain fully tappable to trigger the metric detail view or component drill-down.

#### Scenario: Tapping a compact list row in Valuation Studio
- **WHEN** a user taps anywhere on a compact two-line metric row (e.g., `MVRV Z-Score`) on mobile
- **THEN** the `ValuationStudio` MUST transition into the selected metric's 3-panel detail view (`setSelectedMetric("mvrv_z_score")`) just as it does when clicking a table row on desktop
