## ADDED Requirements

### Requirement: Proportional Lifecycle Cash Deployment

The system SHALL calculate the weekly DCA deployment amount dynamically as a proportion of remaining portfolio cash rather than a static dollar figure, eliminating cash drag in multi-cycle portfolio simulations:
$$\text{DCA Amount} = \min\left(\text{Cash}, \max\left(\text{base\_dca}, \text{Cash} \times \min(1.0, \text{dca\_cash\_pct} \times \text{Multiplier})\right)\right)$$
where `dca_cash_pct` defaults to `0.08` (8% base cash deployment per Monday).

When trimming positions in `DCA_OUT` mode, the system SHALL sell a dynamic fraction ($8\%–15\%$) of the active BTC position into cash to lock in cycle top gains without selling 100% of holdings prematurely.

#### Scenario: Value zone proportional deployment
- **WHEN** portfolio cash is $100,000
- **AND** `valuation_composite` is +0.80 (Multiplier = 1.5x)
- **AND** `dca_cash_pct` is 0.08
- **THEN** weekly deployment amount SHALL be $100,000 \times (0.08 \times 1.5) = \$12,000$ (12% of cash)

#### Scenario: Deep discount bottom proportional deployment
- **WHEN** portfolio cash is $50,000
- **AND** `valuation_composite` is +1.80 (Multiplier = 3.0x)
- **AND** `dca_cash_pct` is 0.08
- **THEN** weekly deployment amount SHALL be $50,000 \times (0.08 \times 3.0) = \$12,000$ (24% of cash)

#### Scenario: Macro top proportional position trimming
- **WHEN** market enters bubble overvaluation (`valuation_composite <= -1.25`)
- **AND** portfolio holds 20.0 BTC
- **THEN** weekly sell execution SHALL sell $8\%–15\%$ of active BTC position into cash
