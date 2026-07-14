# studio-trading-terminals Specification

## Purpose
TBD - created by archiving change add-studio-trading-terminals-and-entropy-parity. Update Purpose after archive.
## Requirements
### Requirement: Studio Client-Side Dynamic Trading Engine
The quantitative terminal SHALL provide a unified client-side dynamic backtesting and trading engine (`useStudioBacktest`) that operates across `ValuationStudio`, `LttdLab`, `MttdConsole`, and `IchimokuTerminal`. The engine MUST strictly isolate trade attribution, equity curves (`Cum_Strat` vs. `Cum_Market`), and performance KPIs to the specific studio's quantitative position series (`pos[i]`). Both the Cumulative Strategy and Cumulative Market curves MUST cover the entire dataset range. For all dates prior to the backtest `startDate`, both curves MUST remain flat at `1.0`. Within the backtest window (`[startDate, endDate]`), both curves MUST compound starting from `1.0` at `startDate`. For all dates after the backtest `endDate`, both curves MUST remain flat at their respective final values achieved at `endDate`.

#### Scenario: Dynamic Date Slicing and Fee Compounding
- **WHEN** the user selects a custom date range (`start_date` to `end_date`) and adjusts the transaction cost slider (`transaction_cost` in basis points, default `10 bps`) inside any deep-dive studio
- **THEN** the client-side engine MUST re-index both `Cum_Strat` and `Cum_Market` starting from `0.00%` (or equity `1.0`) at `start_date`, vectorize daily returns using causal $t-1$ position execution (`Active_Pos[i] = pos[i-1]`), deduct round-trip transaction costs whenever `Active_Pos[i] != Active_Pos[i-1]`, and compute updated KPIs (`Win Rate (%)`, `Profit Factor`, `Total Trades`, `Sharpe Ratio`, `Max Drawdown`) restricted to completed trades within the sliced window. Further, for dates outside the `[start_date, end_date]` window, both curves MUST remain flat: flat at `1.0` before `start_date`, and flat at the terminal compounded equity value after `end_date`.

### Requirement: Studio Dedicated Equity Curve Subplot
Each deep-dive quantitative studio SHALL render a dedicated 4th chart subplot container (`eqChart`) displaying the dynamically compounded Strategy Cumulative Net Return (`Cum_Strat * 100`) alongside the BTC Buy & Hold Return (`Cum_Market * 100`).

#### Scenario: Vertical Crosshair and Y-Axis Width Synchronization
- **WHEN** the `eqChart` subplot is rendered within `ValuationStudio`, `LttdLab`, `MttdConsole`, or `IchimokuTerminal`
- **THEN** the right price scale MUST strictly lock its `minimumWidth` to `85px` (using `getChartYAxisWidth()`) and participate in vertical crosshair synchronization (`CrosshairMode.Normal`) across all sibling subplots (`btcChart`, `imoChart`, etc.) without horizontal time-tick misalignment

### Requirement: Candlestick BUY and SELL Price Markers
Each deep-dive studio's primary `btcChart` SHALL visually indicate quantitative trade entries and exits directly on the candlestick price series using Lightweight Charts `createSeriesMarkers`.

#### Scenario: Rendering Causal Position Transition Markers
- **WHEN** the `useStudioBacktest` engine detects a causal position transition (`pos[i-1] == 0.0` and `pos[i] == 1.0` for BUY, or `pos[i-1] == 1.0` and `pos[i] == 0.0` for SELL)
- **THEN** the studio MUST attach an `#10b981` `arrowUp` marker labeled `BUY` below the bar for entry events, and an `#ef4444` `arrowDown` marker labeled `SELL` above the bar for exit events

### Requirement: Studio Completed Trades Log Table
Each deep-dive studio SHALL display an interactive data table (`trades-table`) beneath the chart panels detailing every completed trade executed within the active date range.

#### Scenario: Displaying Trade Execution Records and Exit Reasons
- **WHEN** trades are extracted from the active date window
- **THEN** the table MUST render columns for `ID`, `Entry Date`, `Entry Price`, `Exit Date`, `Exit Price`, `Return (%)` (styled green for profit, red for loss), `Hold Days`, and `Exit Reason` (`Chikou Exit`, `Macro Exit`, `Circuit Breaker: LTTD Sideways`, `Circuit Breaker: Valuation Bubble`)

