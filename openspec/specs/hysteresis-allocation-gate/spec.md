# hysteresis-allocation-gate Specification

## Purpose
TBD - created by archiving change go-live-valuation-system. Update Purpose after archive.
## Requirements
### Requirement: Transition Hysteresis in SDCA FSM
The Systematic DCA (SDCA) engine SHALL enforce hysteresis bounds on state transitions to reduce transaction whiplash. When the FSM transitions to a high-priority state (such as `SELL_DCA` or `BUY_DCA`), it SHALL require a buffer space (offset of $\pm 0.2$ on `valuation_composite`) before transitioning back to the lower-priority `NEUTRAL` or `HOLD` states.

#### Scenario: Hysteresis-gated state transition
- **WHEN** the SDCA FSM is in state `SELL_DCA` (entered when `valuation_composite <= -1.0`)
- **THEN** it SHALL remain in state `SELL_DCA` unless the `valuation_composite` rises above `-0.8` (enforcing a $0.2$ hysteresis buffer).

