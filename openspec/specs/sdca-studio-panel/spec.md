# SDCA Studio Panel

## Purpose

Valuation Studio UI panel for displaying SDCA strategy state, multiplier gauge, phase indicator, portfolio metrics, and DCA history chart.
## Requirements
### Requirement: SDCA Panel Display

The Valuation Studio SHALL include a collapsible SDCA panel displaying the current SDCA state, positioned below the main chart area.

#### Scenario: Panel visible by default

- **WHEN** Valuation Studio loads
- **THEN** SDCA panel SHALL be visible in collapsed state
- **AND** panel SHALL show summary row with multiplier, phase, and action

#### Scenario: Panel expanded

- **WHEN** user clicks SDCA panel header
- **THEN** panel SHALL expand to show full SDCA details
- **AND** panel SHALL show multiplier gauge, phase indicator, portfolio metrics, and transaction log

### Requirement: Multiplier Gauge Display

The SDCA panel SHALL display the current multiplier as a visual gauge showing the value on a scale from -0.5x to +3.0x with color coding.

| Multiplier Range | Color | Label |
|------------------|-------|-------|
| > 2.0x | Green | Aggressive Buy |
| 1.5x - 2.0x | Light Green | Value Buy |
| 1.0x - 1.5x | Blue | Normal DCA |
| 0.5x - 1.0x | Yellow | Reduce |
| 0.0x - 0.5x | Orange | Pause |
| < 0.0x | Red | Sell |

#### Scenario: Multiplier shows aggressive buy

- **WHEN** SDCA multiplier is 2.5x
- **THEN** gauge SHALL show value at 2.5x position
- **AND** gauge color SHALL be green
- **AND** label SHALL be "Aggressive Buy"

#### Scenario: Multiplier shows sell

- **WHEN** SDCA multiplier is -0.5x
- **THEN** gauge SHALL show value at -0.5x position
- **AND** gauge color SHALL be red
- **AND** label SHALL be "Sell"

### Requirement: Phase Indicator Display

The SDCA panel SHALL display the current market phase with a badge-style indicator.

#### Scenario: Deep Value phase

- **WHEN** SDCA phase is "Deep Value"
- **THEN** phase badge SHALL show "DEEP VALUE"
- **AND** badge color SHALL be green
- **AND** badge icon SHALL be a down arrow (buying opportunity)

#### Scenario: Euphoria phase

- **WHEN** SDCA phase is "Euphoria"
- **THEN** phase badge SHALL show "EUPHORIA"
- **AND** badge color SHALL be red
- **AND** badge icon SHALL be an up arrow (selling opportunity)

### Requirement: Portfolio Metrics Display

The SDCA panel SHALL display portfolio metrics in a grid layout:

- Position: BTC balance (formatted to 8 decimal places)
- Avg Cost: Weighted average cost basis (formatted as $XX,XXX)
- Unrealized P&L: Dollar amount and percentage (color: green if positive, red if negative)
- Portfolio Value: Total value in USD
- Cash Balance: Available cash for DCA

#### Scenario: Metrics display with profit

- **WHEN** btcBalance is 1.5 BTC
- **AND** avgCostBasis is $45,000
- **AND** current price is $65,000
- **AND** cashBalance is $2,000
- **THEN** panel SHALL show:
  - Position: 1.50000000 BTC
  - Avg Cost: $45,000
  - Unrealized P&L: +$30,000 (+44.4%)
  - Portfolio Value: $99,500
  - Cash Balance: $2,000

### Requirement: Transaction Log Display

The SDCA panel SHALL display the last 20 transactions in a scrollable table with columns: Date, Action, Amount, Price, BTC.

#### Scenario: Transaction log populated

- **WHEN** portfolio has 5 transactions
- **THEN** transaction log SHALL show all 5 entries
- **AND** entries SHALL be sorted newest first
- **AND** BUY actions SHALL have green row highlight
- **AND** SELL actions SHALL have red row highlight

#### Scenario: Transaction log empty

- **WHEN** portfolio has 0 transactions
- **THEN** transaction log SHALL show "No transactions yet" placeholder

### Requirement: DCA History Chart

The SDCA panel SHALL include a Lightweight Charts v5.2 chart showing:

1. BTC price (candlestick)
2. SDCA multiplier as area series (secondary Y-axis)
3. Buy/sell markers on price chart

The chart SHALL follow all existing chart rules: 85px Y-axis lock, vertical crosshair sync, and responsive sizing.

#### Scenario: DCA chart renders

- **WHEN** SDCA panel is expanded
- **THEN** DCA history chart SHALL render with BTC price candles
- **AND** multiplier area series SHALL overlay on secondary Y-axis
- **AND** buy markers SHALL appear as green arrows below bars
- **AND** sell markers SHALL appear as red arrows above bars

### Requirement: Responsive Design

The SDCA panel SHALL be responsive across desktop and mobile viewports. It MUST NOT overlap with active maximized chart panels and SHALL be completely hidden when any chart subplot is maximized.

#### Scenario: Desktop layout

- **WHEN** viewport width > 768px
- **THEN** panel SHALL display metrics in a 5-column grid
- **AND** transaction log SHALL show all 5 columns

#### Scenario: Mobile layout

- **WHEN** viewport width ≤ 768px
- **THEN** panel SHALL display metrics in a 2-column grid
- **AND** transaction log SHALL show 3 columns (Date, Action, Amount)
- **AND** DCA chart SHALL stack vertically below metrics

#### Scenario: Panel hides on chart maximize

- **WHEN** any chart subplot is maximized (e.g., BTC, Valuation, or Equity)
- **THEN** the SDCA panel SHALL be automatically hidden to avoid screen coverage or overlapping

### Requirement: Collapsible Panel State

The SDCA panel SHALL remember its collapsed/expanded state across page reloads using localStorage.

#### Scenario: Panel state persistence

- **WHEN** user expands SDCA panel
- **AND** page reloads
- **THEN** SDCA panel SHALL restore to expanded state

#### Scenario: Panel state default

- **WHEN** page loads for first time
- **AND** localStorage does not contain panel state
- **THEN** SDCA panel SHALL default to collapsed state

### Requirement: Parameter Preset Selector

The SDCA panel SHALL provide a dropdown selector for choosing parameter presets.

**Available Presets:**

| Preset | Buy Threshold | Sell Threshold | Description |
|--------|---------------|----------------|-------------|
| `optimized` | -0.5 | +1.5 | Grid search optimized (default) |
| `conservative` | -0.5 | +1.5 | Lower drawdown focus |
| `moderate` | -1.0 | +1.0 | Balanced risk/return |
| `aggressive` | -1.5 | +0.5 | Higher risk, higher return |

#### Scenario: Display preset selector

- **WHEN** SDCA panel is expanded
- **THEN** preset dropdown SHALL be visible in the header row
- **AND** default selection SHALL be "optimized"
- **AND** selection SHALL persist across page reloads via localStorage

#### Scenario: Apply preset

- **WHEN** user selects a different preset
- **THEN** panel SHALL update threshold display
- **AND** selection SHALL be saved to localStorage

### Requirement: Threshold Display

The SDCA panel SHALL display current buy/sell thresholds with an optimization badge.

#### Scenario: Display thresholds

- **WHEN** SDCA panel is expanded
- **THEN** panel SHALL show: `Buy < X` and `Sell >= Y` badges
- **AND** buy badge SHALL be green-tinted
- **AND** sell badge SHALL be red-tinted

#### Scenario: Optimization badge

- **WHEN** selected preset is not "moderate"
- **THEN** panel SHALL display "⚡ OPTIMIZED" badge
- **AND** badge SHALL be yellow-tinted

### Requirement: Alpha Comparison Display

The SDCA panel SHALL display alpha comparison between SDCA and Simple DCA when backtest metrics are available.

#### Scenario: Alpha display

- **WHEN** backtest metrics are available
- **THEN** panel SHALL show "SDCA vs Simple DCA" comparison
- **AND** display the percentage difference
- **AND** color SHALL be green if SDCA outperforms, red if underperforms

#### Scenario: No metrics available

- **WHEN** backtest metrics are not available
- **THEN** alpha comparison section SHALL be hidden

