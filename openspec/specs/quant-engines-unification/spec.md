# quant-engines-unification Specification

## Purpose
TBD - created by syncing change phase-2. Update Purpose after archive.
## Requirements
### Requirement: Valuation Engine Score Output Standardization
The `quant-btc-valuation-system` SHALL compute and output a daily canonical piecewise linear interpolated score (`ValuationComposite` / `valuation_composite`) strictly bounded within the range `[-2.0, +2.0]`. The score computation MUST enforce zero lookahead bias by validating timestamp causality ($t-1$ stamp verification) against `MasterOHLCV` (`master_ohlcv`) records.

#### Scenario: Valuation composite bounded calculation
- **WHEN** the daily valuation pipeline executes for timestamp $t$
- **THEN** it computes the 17-indicator piecewise linear interpolated composite score using strictly causal historical data up to timestamp $t-1$ and guarantees the final output is bounded within `[-2.0, +2.0]`

### Requirement: LTTD Gaussian HMM Orthogonal Regime Classification
The `quant-btc-lttd-system` SHALL classify each trading day into exactly one of three orthogonal market regimes (`LTTDRegime` / `lttd_regime` in `{'BULL', 'BEAR', 'SIDEWAYS'}`) via a 3-State Gaussian Hidden Markov Model (HMM) trained on Log Returns and 20-day Volatility, validated by PCA and VIF pruning ($>10$). The engine MUST output explicit posterior state probabilities for each state ($P_{\text{Bull}}, P_{\text{Bear}}, P_{\text{Sideways}}$) alongside the categorical regime assignment.

#### Scenario: LTTD regime classification and probability output
- **WHEN** the LTTD Gaussian HMM pipeline runs for a given daily timestamp
- **THEN** it outputs the categorical regime assignment (`BULL`, `BEAR`, or `SIDEWAYS`) and explicit posterior state probabilities ($P_{\text{Bull}} + P_{\text{Bear}} + P_{\text{Sideways}} = 1.0$) using strictly causal data up to $t-1$

### Requirement: MTTD Multi-Principle Consensus Oscillator Standardization
The `quant-btc-mttd-system` SHALL compute the `MTTDIntegratedOscillator` (`mttd_imo`) strictly bounded inside `[-1.0, +1.0]` by synthesizing signals across 10 distinct statistical families. The oscillator output MUST be evaluated against three strict internal multi-layer gates: `EfficiencyRatioGate` (`ER >= 0.20`), `ShannonEntropyGate` (`Entropy <= 2.30`), and `ChikouMomentumExit` (`< -0.30`).

#### Scenario: MTTD oscillator bounds and multi-layer gating
- **WHEN** the MTTD multi-principle consensus strategy processes daily `aligned_data`
- **THEN** it outputs an oscillator `mttd_imo` in `[-1.0, +1.0]` along with boolean evaluations for `EfficiencyRatioGate`, `ShannonEntropyGate`, and `ChikouMomentumExit`

### Requirement: Ichimoku Quant SuperSmoother Tanh Oscillator Standardization
The `quant-lttd-ichimoku` system SHALL transform non-stationary Ichimoku cloud components (`S_TK`, `S_Cloud`, `S_Future`, `S_Chikou`) through an Ehlers 2-pole `SuperSmoother` IIR transfer function and a stationary bounded $\tanh$ function to produce the `IchimokuDenoisedOscillator` (`ichimoku_imo`) strictly bounded inside `[-1.0, +1.0]`.

#### Scenario: Ichimoku denoised stationary oscillator generation
- **WHEN** the Ichimoku quant feature and strategy pipelines run for timestamp $t$
- **THEN** they filter raw cloud components via Ehlers 2-pole `SuperSmoother` IIR transfer function and apply $\tanh$ normalization to output `ichimoku_imo` bounded in `[-1.0, +1.0]` without lookahead bias
