## ADDED Requirements

### Requirement: Valuation Studio SDCA Backtest Engine Integration
The `ValuationStudio.tsx` component SHALL compute its Equity Curve, Chart Markers, and Execution Log using the `useSdcaBacktest` engine to accurately reflect the mathematical strategy defined in `sdcaEngine.ts`. The naive `useStudioBacktest` engine SHALL NOT be used for the SDCA panel's backtest.

#### Scenario: Visualising SDCA Strategy Equity Curve
- **WHEN** the user views the Valuation Studio
- **THEN** Pane 3 (Equity Curve) displays the dynamic `cumStrat` equity curve calculated by `useSdcaBacktest` using the true SDCA multipliers.

#### Scenario: Displaying Chart Markers
- **WHEN** the user views the Valuation Studio chart
- **THEN** the chart markers (Buy/Sell arrows) accurately represent SDCA actions (`START_AGGRESSIVE_DCA`, `SELL_ALL`, `REDUCE_POSITION`, etc.) returned by `useSdcaBacktest`.

#### Scenario: Trade Execution Log Accuracy
- **WHEN** the user views the CAUSAL EXECUTION LOG Completed Trade Attribution Table
- **THEN** the table rows reflect trades logged by `useSdcaBacktest`, displaying dynamic multiplier logic and amounts, rather than binary 0/1 positions.
