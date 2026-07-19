# SDCA Studio Panel — Delta Spec

## MODIFIED Requirements

### Requirement: SDCA Configuration Display

The SDCA Studio Panel SHALL display strategy configuration parameters with clear visual indicators for buy/sell thresholds.

**Correct Sign Convention:**

- **Positive composite (+1.0 to +2.0)**: Overvalued → SELL zone
- **Negative composite (-1.0 to -2.0)**: Undervalued → BUY zone

**Display Elements:**

| Element | Description | Location |
|---------|-------------|----------|
| `buy_threshold` | Current buy trigger value (negative) | Configuration panel |
| `sell_threshold` | Current sell trigger value (positive) | Configuration panel |
| `multiplier_range` | Active multiplier range | Signal display |
| `regime_confidence` | Current regime confidence | Status indicator |

#### Scenario: Display corrected configuration (Phase A)

- **WHEN** user opens SDCA Studio Panel
- **THEN** system SHALL display current configuration:
  - Buy Threshold: -1.0 (buy when composite ≤ -1.0)
  - Sell Threshold: +1.0 (sell when composite ≥ +1.0)
  - Multiplier Range: -0.5x to 3.0x

#### Scenario: Display optimized configuration (Phase B)

- **WHEN** optimized thresholds are applied
- **THEN** system SHALL display notification:
  - "SDCA thresholds optimized based on grid search analysis"
  - "Buy threshold: -1.0 → -0.5"
  - "Sell threshold: +1.0 → +1.5"

### Requirement: SDCA Performance Metrics Display

The SDCA Studio Panel SHALL display comprehensive performance metrics with comparison to simple DCA baseline.

**Required Metrics Display:**

| Metric | Display Format | Comparison |
|--------|----------------|------------|
| `sharpeRatio` | "Sharpe: X.XX" | vs Simple DCA |
| `sortinoRatio` | "Sortino: X.XX" | vs Simple DCA |
| `cagr` | "CAGR: XX.X%" | vs Simple DCA |
| `maxDrawdown` | "MaxDD: XX.X%" | Risk indicator |
| `winRate` | "Win Rate: XX.X%" | Trade quality |
| `totalReturn` | "Return: XXXX.X%" | vs Simple DCA |

#### Scenario: Display metrics with corrected strategy

- **WHEN** backtest completes with corrected thresholds
- **THEN** system SHALL display metrics reflecting correct DCA behavior
- **AND** comparison to Simple DCA baseline

#### Scenario: Alpha comparison display

- **WHEN** SDCA outperforms simple DCA
- **THEN** system SHALL display alpha:
  - "SDCA Alpha: +X.X% (vs Simple DCA)"

#### Scenario: Underperformance warning

- **WHEN** SDCA underperforms simple DCA
- **THEN** system SHALL display warning:
  - "⚠️ SDCA underperforms Simple DCA by X.X%"

### Requirement: SDCA Trade Log Display

The SDCA Studio Panel SHALL display trade log with filtering and sorting capabilities.

**Trade Log Columns:**

| Column | Description | Format |
|--------|-------------|--------|
| `date` | Trade date | YYYY-MM-DD |
| `action` | BUY or SELL | Badge (green/red) |
| `amount` | USD amount | $X,XXX.XX |
| `price` | BTC price | $XX,XXX |
| `multiplier` | DCA multiplier | X.Xx |
| `profit_pct` | Profit percentage (sells only) | +XX.X% / -XX.X% |

#### Scenario: Display trade log

- **WHEN** backtest completes
- **THEN** system SHALL display trade log with:
  - Sorted by date (newest first)
  - BUY actions in green
  - SELL actions in red
  - Profit percentage for SELL actions

#### Scenario: Filter trades by action

- **WHEN** user clicks "Buys Only" filter
- **THEN** system SHALL display only BUY trades

#### Scenario: Filter trades by date range

- **WHEN** user selects date range filter
- **THEN** system SHALL display trades within selected range

### Requirement: SDCA Equity Curve Display

The SDCA Studio Panel SHALL display equity curve chart with crosshair synchronization and Y-axis width lock.

**Chart Specifications:**

- **Library**: Lightweight Charts v5.2
- **Y-Axis Width**: Locked to 85px (right side)
- **Crosshair**: Vertical synchronization across all subplots
- **Series**:
  - `sdca`: SDCA strategy equity (blue line)
  - `simpleDca`: Simple DCA baseline (gray line)
  - `buyHold`: Buy and hold baseline (dashed line)

#### Scenario: Display equity curve

- **WHEN** backtest completes
- **THEN** system SHALL render equity curve with:
  - SDCA strategy line (blue)
  - Simple DCA line (gray)
  - Buy and hold line (dashed)
  - Y-axis locked to 85px width

#### Scenario: Crosshair synchronization

- **WHEN** user hovers over equity curve
- **THEN** system SHALL display synchronized crosshair across all subplots
- **AND** tooltip SHALL show all three equity values at hovered date

#### Scenario: Y-axis consistency

- **WHEN** equity curve renders
- **THEN** system SHALL ensure:
  - Right Y-axis width is exactly 85px
  - Price labels are readable (no truncation)
  - Oscillator labels are readable (no truncation)

## ADDED Requirements

### Requirement: Parameter Preset Selection (Phase B)

The SDCA Studio Panel SHALL provide preset selection for quick configuration of optimized parameters.

**Available Presets:**

| Preset | Buy Threshold | Sell Threshold | Description |
|--------|---------------|----------------|-------------|
| `optimized` | -0.5 | +1.5 | Grid search optimized (default) |
| `conservative` | -0.5 | +1.5 | Lower drawdown focus |
| `moderate` | -1.0 | +1.0 | Balanced risk/return |
| `aggressive` | -1.5 | +0.5 | Higher risk, higher return |

#### Scenario: Display preset selector

- **WHEN** user opens SDCA Studio Panel
- **THEN** system SHALL display preset dropdown with:
  - "Optimized (Grid Search)" as default
  - Other presets as options

#### Scenario: Apply preset configuration

- **WHEN** user selects "Conservative" preset
- **THEN** system SHALL update:
  - Buy threshold to -0.5
  - Sell threshold to +1.5
  - Recalculate backtest with new parameters

#### Scenario: Custom parameter mode

- **WHEN** user selects "Custom" preset
- **THEN** system SHALL enable manual input fields for:
  - Buy threshold (range: -2.0 to 0.0)
  - Sell threshold (range: 0.0 to +2.0)
