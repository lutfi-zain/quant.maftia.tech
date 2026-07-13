# studio-fe-features-and-metrics-parity Specification

## Purpose
TBD - created by archiving change audit-all-studios-prior-system-parity. Update Purpose after archive.
## Requirements
### Requirement: Valuation Studio 1:1 Metric Parity and Interactive Feature Parity against `quant-btc-valuation-system`

The frontend `ValuationStudio.tsx` SHALL accurately display all 11 performance metrics, exact trade execution history (`trades` array), and interactive threshold controls matching the prior system (`../quant-btc-valuation-system`) exactly $1:1$ ($|a-b| < 10^{-6}$) over historical time windows and the default window (`2018-01-01` to `NOW()`).

#### Scenario: 9-card metric grid matches Valuation Python engine
- **WHEN** `ValuationStudio.tsx` renders performance metrics for the `2018-01-01` to `NOW()` window
- **THEN** every metric (`Win Rate`, `Profit Factor`, `Total Trades`, `Sharpe Ratio vs Market`, `Ann. Return vs Market`, `Ann. Volatility vs Market`, `Max Drawdown vs Market`, and `Total Return vs Market`) SHALL match the automated Python verification harness (`verify_valuation_studio_metrics_1to1.py`) with $|a-b| < 10^{-6}$

#### Scenario: Causal position extraction without lookahead bias
- **WHEN** `ValuationStudio.tsx` computes simulated returns
- **THEN** it SHALL apply causal $T-1$ position shifting where $Active\_Pos[t] = Pos[t-1]$ (with position set to $0$ when `valuation_composite >= 1.50` bubble override triggers, and set to $1$ when `valuation_composite <= -1.00` discount triggers)

#### Scenario: Interactive sub-component weighting and threshold simulation
- **WHEN** the user interacts with component weights or threshold sliders (`Bubble Threshold >= 1.50`, `Discount Threshold <= -1.00`)
- **THEN** `ValuationStudio.tsx` SHALL dynamically recalculate simulated equity curves and metrics in real-time, displaying both authoritative reference curves and interactive What-If curves

### Requirement: LTTD Lab 1:1 Metric Parity and Interactive Feature Parity against `quant-btc-lttd-system`

The frontend `LttdLab.tsx` SHALL accurately display all 11 performance metrics, exact trade execution history (`trades` table), and interactive HMM regime probability controls matching the prior system (`../quant-btc-lttd-system`) exactly $1:1$ ($|a-b| < 10^{-6}$).

#### Scenario: 9-card metric grid matches LTTD Python engine
- **WHEN** `LttdLab.tsx` renders performance metrics for the `2018-01-01` to `NOW()` window
- **THEN** every metric card SHALL match `verify_lttd_studio_metrics_1to1.py` with $|a-b| < 10^{-6}$

#### Scenario: Causal HMM position shifting and sideways override
- **WHEN** `LttdLab.tsx` determines position exposure
- **THEN** position $Pos[t]$ SHALL be $1$ when `lttd_regime === "BULL"` AND `lttd_prob_sideways <= 0.60`, and $0$ otherwise (`SIDEWAYS` probability $> 0.60$ forces zero exposure), applied causally at $T-1$ ($Active\_Pos[t] = Pos[t-1]$)

#### Scenario: Synchronized HMM probability and volatility subplots
- **WHEN** `LttdLab.tsx` displays multi-pane subplots (`btcChart`, `hmmChart`, `returnsChart`, `volChart`, `eqChart`)
- **THEN** every subplot SHALL enforce `rightPriceScale: { minimumWidth: 85 }` and bidirectional vertical crosshair synchronization (`syncCrosshairs`)

### Requirement: MTTD Console 1:1 Metric Parity and Interactive Feature Parity against `quant-btc-mttd-system`

The frontend `MttdConsole.tsx` SHALL accurately display all 11 performance metrics, exact trade execution history (`trades` table), and interactive gate controls matching the prior system (`../quant-btc-mttd-system`) exactly $1:1$ ($|a-b| < 10^{-6}$).

#### Scenario: 9-card metric grid matches MTTD Python engine
- **WHEN** `MttdConsole.tsx` renders performance metrics for the `2020-01-01` to `NOW()` window
- **THEN** every metric card SHALL match `verify_mttd_studio_metrics_1to1.py` exactly ($|a-b| < 10^{-6}$)

#### Scenario: Multi-principle consensus oscillator with ER and Entropy gates
- **WHEN** `MttdConsole.tsx` evaluates causal backtest positions
- **THEN** position $Pos[t]$ SHALL be $1$ when `mttd_imo > 0.15` AND `mttd_er >= 0.20` AND `mttd_entropy <= 2.30`, and $0$ otherwise, applied at $T-1$ ($Active\_Pos[t] = Pos[t-1]$)

#### Scenario: Synchronized multi-principle gate subplots
- **WHEN** `MttdConsole.tsx` displays multi-pane subplots (`btcChart`, `imoChart`, `gatesChart`, `eqChart`)
- **THEN** every subplot SHALL enforce `rightPriceScale: { minimumWidth: 85 }` and bidirectional vertical crosshair synchronization

### Requirement: Ichimoku Terminal 1:1 Metric Parity and Interactive Feature Parity against `quant-lttd-ichimoku`

The frontend `IchimokuTerminal.tsx` SHALL accurately display all 11 performance metrics, exact trade execution history (`trades` table), leading/lagging momentum features, reference vs strategy equity curves, and interactive What-If scenario overlays matching the prior system (`../quant-lttd-ichimoku`) exactly $1:1$ ($|a-b| < 10^{-6}$).

#### Scenario: 100% exact 1:1 match across all windows against `verify_ichimoku_studio_metrics_1to1.py`
- **WHEN** `IchimokuTerminal.tsx` renders metrics for either the `2018-01-01` or `2011-01-01` to `NOW()` window
- **THEN** every single performance metric SHALL match `verify_ichimoku_studio_metrics_1to1.py` exactly 1:1 without deviation ($|a-b| < 10^{-6}$)

#### Scenario: Lagging and leading momentum chart features and vertical crosshair synchronization
- **WHEN** `IchimokuTerminal.tsx` displays the 4-pane subplots (`btcChart`, `oscChart`, `sCompChart`, `eqChart`)
- **THEN** it SHALL render API-provided leading (`S_Future`) and lagging (`S_Chikou`) momentum indicators, enforce `rightPriceScale: { minimumWidth: 85 }` on all panes, and maintain real-time vertical crosshair synchronization across the entire stack

