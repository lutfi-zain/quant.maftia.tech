## MODIFIED Requirements

### Requirement: Valuation Studio 1:1 Metric Parity and Interactive Feature Parity against `quant-btc-valuation-system`

The frontend `ValuationStudio.tsx` SHALL accurately display all 11 performance metrics, exact trade execution history (`trades` array), interactive threshold controls matching the prior system (`../quant-btc-valuation-system`) exactly $1:1$ ($|a-b| < 10^{-6}$) over historical time windows, and standardized chart marker overlays clearly differentiating Macro Confluence Signals from Portfolio Execution Orders.

#### Scenario: 9-card metric grid matches Valuation Python engine
- **WHEN** `ValuationStudio.tsx` renders performance metrics for the `2018-01-01` to `NOW()` window
- **THEN** every metric (`Win Rate`, `Profit Factor`, `Total Trades`, `Sharpe Ratio vs Market`, `Ann. Return vs Market`, `Ann. Volatility vs Market`, `Max Drawdown vs Market`, and `Total Return vs Market`) SHALL match the automated Python verification harness (`verify_valuation_studio_metrics_1to1.py`) with $|a-b| < 10^{-6}$

#### Scenario: Causal position extraction without lookahead bias
- **WHEN** `ValuationStudio.tsx` computes simulated returns
- **THEN** it SHALL apply causal $T-1$ position shifting where $Active\_Pos[t] = Pos[t-1]$ (with position set to $0$ when `valuation_composite >= 1.50` bubble override triggers, and set to $1$ when `valuation_composite <= -1.00` discount triggers)

#### Scenario: Interactive sub-component weighting and threshold simulation
- **WHEN** the user interacts with component weights or threshold sliders (`Bubble Threshold >= 1.50`, `Discount Threshold <= -1.00`)
- **THEN** `ValuationStudio.tsx` SHALL dynamically recalculate simulated equity curves and metrics in real-time, displaying both authoritative reference curves and interactive What-If curves

#### Scenario: Standardized marker overlay and visual taxonomy
- **WHEN** markers are rendered on the candlestick price panel in `ValuationStudio.tsx`
- **THEN** Portfolio Execution Orders (`BUY_DCA`, `BUY_ALL`, `SELL_DCA`, `SELL_ALL`) SHALL be styled with directional green/red arrows (`arrowUp`/`arrowDown`)
- **AND** Macro Confluence Signals (`VAL ACCUM`, `VAL BUBBLE`) SHALL be clearly distinguished with system-specific labels and cyan/magenta coloring
