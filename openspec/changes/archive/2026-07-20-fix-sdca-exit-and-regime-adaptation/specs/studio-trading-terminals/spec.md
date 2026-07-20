## MODIFIED Requirements

### Requirement: Studio SDCA Trading Engine

The quantitative terminal SHALL provide a unified SDCA trading engine that operates across `ValuationStudio` and `LttdLab`, `MttdConsole`, `IchimokuTerminal`. The `ValuationStudio` MUST strictly consume pre-calculated backend ledgers and scores from the API Gateway, acting exclusively as a thin rendering layer rather than recomputing the calculations locally. The frontend SHALL display the current market regime (BULL/BEAR detected via MA200) and ATH drawdown percentage alongside the SDCA multiplier and phase.

#### Scenario: Displaying Market Regime and Drawdown

- **WHEN** the Valuation Studio loads SDCA data from the API
- **THEN** the panel SHALL display:
  - Current market regime (BULL 🟢 / BEAR 🔴) detected from the backend
  - Current drawdown percentage from All-Time High
  - SDCA exit stage status (NORMAL / REDUCE / SELL_ALL) with the applicable price confirmation gate status
