## MODIFIED Requirements

### Requirement: Studio Client-Side Dynamic Trading Engine

The quantitative terminal SHALL provide a unified client-side dynamic backtesting and trading engine (`useStudioBacktest`) that operates across `LttdLab`, `MttdConsole`, and `IchimokuTerminal`. However, the `ValuationStudio` MUST strictly consume pre-calculated backend ledgers and scores from the API Gateway, acting exclusively as a thin rendering layer rather than recomputing the calculations locally. The engine (for remaining studios) MUST strictly isolate trade attribution, equity curves (`Cum_Strat` vs. `Cum_Market`), and performance KPIs to the specific studio's quantitative position series (`pos[i]`). Both the Cumulative Strategy and Cumulative Market curves MUST cover the entire dataset range. For all dates prior to the backtest `startDate`, both curves MUST remain flat at `1.0`. Within the backtest window (`[startDate, endDate]`), both curves MUST compound starting from `1.0` at `startDate`. For all dates after the backtest `endDate`, both curves MUST remain flat at their respective final values achieved at `endDate`.

#### Scenario: Dynamic Date Slicing and Fee Compounding

- **WHEN** the user selects a custom date range (`start_date` to `end_date`) and adjusts the transaction cost slider (`transaction_cost` in basis points, default `10 bps`) inside any deep-dive studio
- **THEN** the `ValuationStudio` MUST re-render the view by re-slicing the backend-provided continuous array data directly, without invoking client-side compounding math. For the other studios (`LttdLab`, `MttdConsole`, `IchimokuTerminal`), the client-side engine MUST re-index both `Cum_Strat` and `Cum_Market` starting from `0.00%` (or equity `1.0`) at `start_date`, vectorize daily returns using causal $t-1$ position execution (`Active_Pos[i] = pos[i-1]`), deduct round-trip transaction costs whenever `Active_Pos[i] != Active_Pos[i-1]`, and compute updated KPIs (`Win Rate (%)`, `Profit Factor`, `Total Trades`, `Sharpe Ratio`, `Max Drawdown`) restricted to completed trades within the sliced window. Further, for dates outside the `[start_date, end_date]` window, both curves MUST remain flat: flat at `1.0` before `start_date`, and flat at the terminal compounded equity value after `end_date`.

### ADDED Requirement: SDCA Phase Timeline Visualization

The `ValuationStudio` SHALL render a colored phase timeline strip below the main price chart showing the historical `sdca_phase` progression. The strip SHALL use five phase colors: `deep_discount` (#10B981/green), `value` (#3B82F6/blue), `fair` (#6B7280/gray), `expansion` (#F59E0B/orange), `euphoria` (#EF4444/red).

#### Scenario: Phase Timeline Renders Correctly

- **WHEN** the Valuation Studio loads with `dailyData` containing `sdca_phase` values
- **THEN** the timeline SHALL render a horizontal strip divided into colored segments proportional to each phase's duration, synced to the same time axis as the price chart above.

### REMOVED Requirement: Indicator Cards for Redundant Metrics

**Reason**: `williams_r` (single-sided oscillator, 5655 missing days) and `fear_greed_cmc` (r=0.918 redundant with `fear_greed_og`) add visual clutter without independent signal value.

**Migration**: The component grid in Valuation Studio SHALL display 14 indicator cards instead of 17, omitting `williams_r` and `fear_greed_cmc`.
