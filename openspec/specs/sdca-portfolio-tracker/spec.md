# SDCA Portfolio Tracker

Portfolio state management for Strategic DCA strategy, tracking cumulative BTC accumulation, cost basis, cash balance, and transaction logging.

## Requirements

### Requirement: Portfolio State Management

The system SHALL maintain a portfolio state object containing:

- `btcBalance`: Cumulative BTC holdings (float)
- `cashBalance`: USD cash available for DCA (float)
- `avgCostBasis`: Weighted average cost per BTC in USD (float)
- `totalInvested`: Total USD invested to date (float)
- `totalFeesPaid`: Total transaction fees paid in USD (float)
- `transactionLog`: Array of all DCA transactions with timestamp, action, amount, price, and resulting balance

#### Scenario: Initial portfolio state

- **WHEN** SDCA tracker is initialized
- **THEN** `btcBalance` SHALL be 0.0
- **AND** `cashBalance` SHALL be configurable (default 10000.0 USD)
- **AND** `avgCostBasis` SHALL be 0.0
- **AND** `totalInvested` SHALL be 0.0
- **AND** `totalFeesPaid` SHALL be 0.0
- **AND** `transactionLog` SHALL be empty array

### Requirement: DCA Buy Execution

When the SDCA signal action is "BUY" with multiplier > 0, the system SHALL:

1. Calculate `buyAmount = baseDcaAmount × multiplier`
2. Calculate `fee = buyAmount × feeRate`
3. Deduct `buyAmount + fee` from `cashBalance`
4. Calculate `btcPurchased = (buyAmount - fee) / currentPrice`
5. Add `btcPurchased` to `btcBalance`
6. Update `avgCostBasis = (previousTotalCost + buyAmount) / btcBalance`
7. Add `buyAmount` to `totalInvested`
8. Add `fee` to `totalFeesPaid`
9. Append transaction to `transactionLog`

Where `baseDcaAmount` is configurable (default $100/week) and `feeRate` is configurable (default 0.001 = 10 bps).

#### Scenario: Normal DCA buy

- **WHEN** multiplier is 1.0x
- **AND** baseDcaAmount is $100
- **AND** feeRate is 10 bps
- **AND** current BTC price is $60,000
- **AND** cashBalance is $5,000
- **THEN** buyAmount SHALL be $100
- **AND** fee SHALL be $0.10
- **AND** btcPurchased SHALL be 0.001665 BTC
- **AND** cashBalance SHALL decrease to $4,899.90
- **AND** btcBalance SHALL increase by 0.001665 BTC

#### Scenario: Aggressive DCA buy

- **WHEN** multiplier is 3.0x
- **AND** baseDcaAmount is $100
- **AND** current BTC price is $60,000
- **AND** cashBalance is $5,000
- **THEN** buyAmount SHALL be $300
- **AND** btcPurchased SHALL be 0.004995 BTC (after fees)

#### Scenario: Insufficient cash

- **WHEN** buyAmount + fee > cashBalance
- **THEN** system SHALL purchase only what cashBalance allows after fees
- **AND** cashBalance SHALL be 0 after purchase
- **AND** transaction SHALL be logged with actual amount

### Requirement: DCA Sell Execution

When the SDCA signal action is "SELL" or "REDUCE_POSITION", the system SHALL sell BTC worth a specific USD amount (NOT a percentage of holdings).

**Sell Amount Calculation:**

- For "REDUCE_POSITION": `sellValueUsd = baseDcaAmount × abs(multiplier)`
  - Example: multiplier -0.5x, baseDcaAmount $100 → sell $50 worth of BTC
- For "SELL_ALL": `sellValueUsd = btcBalance × currentPrice` (sell everything)

**Execution Steps:**

1. Calculate `sellValueUsd` based on action type
2. Calculate `btcToSell = sellValueUsd / currentPrice`
3. Calculate `fee = sellValueUsd × feeRate`
4. Calculate `proceeds = sellValueUsd - fee`
5. Subtract `btcToSell` from `btcBalance`
6. Add `proceeds` to `cashBalance`
7. Update `avgCostBasis` (unchanged if partial sell, 0 if full sell)
8. Add `fee` to `totalFeesPaid`
9. Append transaction to `transactionLog`

#### Scenario: Partial sell (reduce by weekly allocation amount)

- **WHEN** action is "REDUCE_POSITION"
- **AND** multiplier is -0.5x
- **AND** baseDcaAmount is $100
- **AND** btcBalance is 1.0 BTC
- **AND** current BTC price is $100,000
- **AND** feeRate is 10 bps
- **THEN** sellValueUsd SHALL be $50 (50% of weekly allocation)
- **AND** btcToSell SHALL be 0.000500 BTC
- **AND** fee SHALL be $0.05
- **AND** proceeds SHALL be $49.95
- **AND** btcBalance SHALL decrease to 0.999500 BTC
- **AND** cashBalance SHALL increase by $49.95

#### Scenario: Full sell (sell all holdings)

- **WHEN** action is "SELL_ALL"
- **AND** btcBalance is 0.5 BTC
- **AND** current BTC price is $120,000
- **AND** feeRate is 10 bps
- **THEN** sellValueUsd SHALL be $60,000
- **AND** btcToSell SHALL be 0.5 BTC
- **AND** fee SHALL be $60.00
- **AND** proceeds SHALL be $59,940.00
- **AND** btcBalance SHALL be 0.0
- **AND** avgCostBasis SHALL be 0.0

### Requirement: Portfolio Metrics Calculation

The system SHALL calculate and expose the following portfolio metrics:

- `unrealizedPnl`: `(btcBalance × currentPrice) - totalInvested`
- `unrealizedPnlPct`: `unrealizedPnl / totalInvested × 100`
- `portfolioValue`: `(btcBalance × currentPrice) + cashBalance`
- `totalReturn`: `portfolioValue - initialCashBalance`
- `totalReturnPct`: `totalReturn / initialCashBalance × 100`
- `totalFeesPaid`: Sum of all transaction fees
- `costBasisAdvantage`: Difference between SDCA avg cost and simple DCA avg cost (if available)
- `accumulationEfficiency`: Total BTC accumulated per dollar invested

#### Scenario: Profitable portfolio

- **WHEN** btcBalance is 1.0 BTC
- **AND** current BTC price is $80,000
- **AND** totalInvested is $50,000
- **AND** cashBalance is $10,000
- **AND** totalFeesPaid is $50
- **THEN** unrealizedPnl SHALL be $30,000
- **AND** unrealizedPnlPct SHALL be 60.0%
- **AND** portfolioValue SHALL be $90,000

#### Scenario: Underwater portfolio

- **WHEN** btcBalance is 1.0 BTC
- **AND** current BTC price is $40,000
- **AND** totalInvested is $50,000
- **AND** cashBalance is $10,000
- **THEN** unrealizedPnl SHALL be -$10,000
- **AND** unrealizedPnlPct SHALL be -20.0%
- **AND** portfolioValue SHALL be $50,000

### Requirement: Transaction Log

The system SHALL maintain a chronological transaction log with the following fields per entry:

- `timestamp`: ISO 8601 date string
- `action`: "BUY" | "SELL" | "SELL_ALL"
- `multiplier`: SDCA multiplier at time of transaction
- `phase`: Market phase at time of transaction
- `amountUsd`: USD amount transacted (before fees)
- `feeUsd`: Transaction fee in USD
- `proceedsUsd`: Net USD amount (for sells) or cost (for buys)
- `btcAmount`: BTC amount transacted
- `price`: BTC price at transaction
- `btcBalanceAfter`: BTC balance after transaction
- `cashBalanceAfter`: Cash balance after transaction

#### Scenario: Transaction logged on buy

- **WHEN** SDCA executes a BUY of $100 at $60,000/BTC with $0.10 fee
- **THEN** transaction entry SHALL contain:
  - `action`: "BUY"
  - `amountUsd`: 100.0
  - `feeUsd`: 0.10
  - `proceedsUsd`: 100.0 (cost)
  - `btcAmount`: 0.001665
  - `price`: 60000.0
  - `multiplier`: 1.0
  - `phase`: "Fair"

### Requirement: Portfolio State Persistence

The system SHALL persist portfolio state to localStorage after each transaction. On page load, the system SHALL restore portfolio state from localStorage if available.

**Known Limitation:** localStorage is per-browser, per-device. Users lose portfolio history on cache clear, incognito mode, or device switch. The transaction log is the source of truth and can be exported for backup.

#### Scenario: State persistence

- **WHEN** a transaction is executed
- **THEN** portfolio state SHALL be saved to localStorage key "sdca_portfolio_state"

#### Scenario: State restoration

- **WHEN** page loads
- **AND** localStorage contains "sdca_portfolio_state"
- **THEN** portfolio state SHALL be restored from localStorage
- **AND** all metrics SHALL be recalculated from restored state

#### Scenario: Fresh state

- **WHEN** page loads
- **AND** localStorage does not contain "sdca_portfolio_state"
- **THEN** portfolio state SHALL be initialized with default values

#### Scenario: Transaction log export

- **WHEN** user clicks "Export Transaction Log"
- **THEN** system SHALL download a CSV file with all transaction records
- **AND** CSV SHALL include all fields from the transaction log
