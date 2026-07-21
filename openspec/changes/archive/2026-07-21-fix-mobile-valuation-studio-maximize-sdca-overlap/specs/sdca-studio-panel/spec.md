## MODIFIED Requirements

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
