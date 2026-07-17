## Why

The Valuation Studio currently uses a **binary threshold strategy** (`composite >= 1.50 → cash, else → full long`). This simple all-or-nothing approach leaves significant risk-adjusted return on the table and doesn't leverage the full spectrum of the valuation composite signal.

The valuation composite uses the following sign convention (confirmed from codebase):

- **Positive composite (+1.0 to +2.0)** = Overvalued / Bubble zone → historically precedes price tops
- **Negative composite (-1.0 to -2.0)** = Undervalued / Deep discount → historically precedes price bottoms
- **Composite 0.0** = Fair value

Historical analysis (2015–2026) reveals that the valuation composite is a **leading indicator** for Bitcoin cycle phases:

- When composite ≤ -1.0 (deep discount): Forward 180d return averages **+55% to +75%** (buy zone)
- When composite ≥ +1.0 (euphoria): Forward 365d return averages **-23.6%** (sell zone)

**Strategic Dollar Cost Averaging (SDCA)** modulates DCA allocation based on valuation zones — buying aggressively when undervalued (negative composite), reducing when fair, stopping when expensive, and selling when euphoric (positive composite). This transforms the Valuation Studio from a simple signal display into an **actionable accumulation engine** with measurable edge over naive DCA.

## What Changes

- **New SDCA Strategy Engine**: Piecewise linear multiplier function mapping `valuation_composite ∈ [-2.0, +2.0]` to DCA allocation multiplier `[-0.5x, +3.0x]`
- **Cycle Phase Detection**: Real-time classification of market phases (Deep Discount, Accumulation, Fair, Expansion, Euphoria) based on composite score + price percentile + trend
- **DCA Entry/Exit Rules**: Formal conditions for starting aggressive DCA at bottoms, transitioning to normal DCA, pausing at euphoria, and selling at tops
- **Portfolio Tracker**: Cumulative BTC accumulation, average cost basis, cash balance, and unrealized P&L tracking
- **Valuation Studio Integration**: New SDCA panel in Valuation Studio showing multiplier, phase, portfolio metrics, and DCA history

## Capabilities

### New Capabilities

- `sdca-strategy-engine`: Core SDCA multiplier function, cycle phase detection, DCA entry/exit rule engine, and portfolio state management
- `sdca-portfolio-tracker`: Position tracking, cost basis calculation, cash balance management, and transaction logging
- `sdca-studio-panel`: Valuation Studio UI panel displaying SDCA state, multiplier, phase, portfolio metrics, and DCA history chart

### Modified Capabilities

- `studio-trading-terminals`: Extend with SDCA-specific controls and metrics display

## Impact

**Systems Impacted:**

- `quant-btc-valuation-system` (primary): New SDCA engine module, extended composite signal output
- Valuation Studio (`web/src/components/studios/ValuationStudio.tsx`): New SDCA panel integration
- Backtest engine (`web/src/lib/studioBacktest.ts`): Extended to support continuous multiplier-based DCA simulation

**Non-Goals:**

- No changes to LTTD, MTTD, or Ichimoku systems
- No changes to the valuation composite calculation itself (17 indicators remain unchanged)
- No automated trade execution (DCA signals are advisory, not executable)
- No integration with external exchanges or brokers

**Affected Code:**

- New: `web/src/lib/sdcaEngine.ts` (TypeScript SDCA signal engine)
- New: `web/src/lib/sdcaPortfolio.ts` (TypeScript portfolio tracker)
- New: `web/src/components/studios/SdcaPanel.tsx` (React component)
- Modified: `web/src/lib/studioBacktest.ts` (extended backtest)
- Modified: `web/src/components/studios/ValuationStudio.tsx` (panel integration)

**Dependencies:** None (uses existing valuation composite data)
