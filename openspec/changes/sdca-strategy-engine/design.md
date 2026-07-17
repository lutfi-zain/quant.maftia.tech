## Context

The Valuation Studio currently uses a binary threshold strategy (`composite >= 1.50 → cash, else → full long`). The backtest engine (`useStudioBacktest`) already supports continuous position values (`-1, 0, +1`) and tracks portfolio metrics (Sharpe, win rate, profit factor, max drawdown).

The Valuation System produces a daily `valuation_composite ∈ [-2.0, +2.0]` from 17 indicators across Fundamental, Technical, and Sentiment categories. This composite is available via the API gateway and stored in the database.

**Sign Convention (confirmed from codebase):**

- **Positive composite (+1.0 to +2.0)** = Overvalued / Bubble zone → historically precedes price tops
- **Negative composite (-1.0 to -2.0)** = Undervalued / Deep discount → historically precedes price bottoms
- **Composite 0.0** = Fair value

Source: `ValuationStudio.tsx:243` → `score >= 1.50 ? 0 : 1` (cash when high, long when low)
Source: `circuit-breakers.ts:38` → `bubble_warning at >= +1.50`

Historical analysis (2015–2026) shows the composite correlates with cycle phases:

- Composite ≤ -1.0 (deep discount) with price < 25th percentile → **+63.6% forward 180d return** (buy zone)
- Composite ≥ +1.0 (euphoria) with price > 80th percentile → **-23.6% forward 365d return** (sell zone)

## Goals / Non-Goals

**Goals:**

- Build a piecewise linear SDCA multiplier function that maps `valuation_composite` to allocation multiplier `[-0.5x, +3.0x]`
- Implement cycle phase detection (Deep Discount, Accumulation, Fair, Expansion, Euphoria)
- Create portfolio tracking (cumulative BTC, cost basis, cash balance, transaction log)
- Integrate SDCA panel into Valuation Studio with multiplier display, phase indicator, and portfolio metrics
- Extend backtest engine to simulate SDCA strategy vs simple DCA vs buy & hold
- Include walk-forward validation to prevent overfitting
- Model transaction costs explicitly

**Non-Goals:**

- No automated trade execution (signals are advisory)
- No changes to LTTD, MTTD, or Ichimoku systems
- No changes to the valuation composite calculation itself
- No external exchange integration
- No real-time WebSocket streaming for SDCA (daily resolution is sufficient)

## Decisions

### Decision 1: Piecewise Linear Multiplier (vs Sigmoid vs Discrete Buckets)

**Choice:** Piecewise linear function with 7 zones

**Rationale:**

- Sigmoid is smoother but harder to interpret and debug
- Discrete buckets create cliff effects at boundaries
- Piecewise linear is transparent, tunable, and backtestable
- Each zone maps to a clear market phase with historical justification

**Alternative considered:** Sigmoid `multiplier = 2.0 / (1 + exp(-2 * composite))`

- Rejected: Non-transparent, harder to explain to users, no clear phase boundaries

### Decision 2: Client-Side Computation (vs Server-Side)

**Choice:** Compute SDCA signals and portfolio state client-side in TypeScript

**Rationale:**

- SDCA operates on daily data already fetched by Valuation Studio
- No new API endpoints needed — reuses existing `/api/v1/components` and `/api/v1/ohlcv`
- Client-side computation enables instant UI feedback on parameter changes
- Portfolio state can be persisted to localStorage for session continuity

**Alternative considered:** Python backend engine with API endpoints

- Rejected: Adds latency, requires new API routes, overkill for daily resolution

### Decision 3: Portfolio State Management (vs External DB)

**Choice:** In-memory state with localStorage persistence

**Rationale:**

- SDCA is advisory — no real money at stake
- localStorage provides persistence across page reloads
- No database schema changes required
- Can be extended to backend persistence later if needed

**Alternative considered:** SQLite table in `maftia_quant.db`

- Rejected: Overkill for advisory signals, adds complexity

### Decision 4: Backtest Extension (vs New Backtest Engine)

**Choice:** Extend existing `useStudioBacktest` with SDCA mode

**Rationale:**

- Existing engine already handles t-1 causal logic, fee modeling, metrics
- SDCA mode adds multiplier-based position sizing instead of binary
- Keeps all backtest logic in one place for maintainability

**Alternative considered:** Separate SDCA backtest engine

- Rejected: Code duplication, inconsistent metrics, harder to compare strategies

### Decision 5: Walk-Forward Validation (vs Single Train/Test Split)

**Choice:** Walk-forward validation with configurable rolling windows

**Rationale:**

- Single train/test split is sensitive to the chosen split point
- Walk-forward provides more robust out-of-sample performance estimation
- Reduces overfitting risk for piecewise threshold tuning
- Industry standard for time-series strategy validation

**Specification:**

- Training window: 3 years rolling (configurable)
- Out-of-sample test: 6 months forward
- Minimum 4 folds required
- Performance must be reported per fold

### Decision 6: Transaction Cost Modeling

**Choice:** Explicit transaction cost parameter with fee-adjusted metrics

**Rationale:**

- SDCA trades ~7x more frequently than binary strategy (7 zones vs 2 states)
- Even 10 bps per trade compounds significantly over years
- Users need to see fee-adjusted vs fee-free performance
- Prevents false confidence in backtest results

**Specification:**

- Default fee: 10 bps per trade (configurable)
- Total fees paid tracked in portfolio metrics
- Fee-adjusted Sharpe ratio reported alongside raw Sharpe

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| **Regime blindness**: Composite assumes mean reversion; new regime (post-ETF) may not follow historical patterns | Add regime confidence metric; circuit breaker if composite directionally wrong for > 6 months; max allocation cap during uncertainty |
| **Early exit**: Selling at composite ≥ +1.0 may be premature if euphoria extends | Default to gradual exit (sell weekly DCA allocation amount, not % of holdings) not lump sum; allow user override |
| **Too much cash**: Stopping DCA misses rallies | Enforce minimum 10% position even in euphoria; resume DCA when composite < 0.0 |
| **Overfitting**: Piecewise thresholds tuned on historical data | Walk-forward validation required; sensitivity analysis on ±20% threshold variation; allow user customization |
| **Transaction cost drag**: Frequent rebalancing compounds fees | Model costs explicitly; report fee-adjusted metrics; compare fee-adjusted vs fee-free |
| **UI complexity**: SDCA panel adds cognitive load | Collapsible panel; default to simple view; advanced view on demand |
| **localStorage persistence**: Portfolio state lost on cache clear | Document limitation; transaction log is source of truth (recoverable) |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SDCA SYSTEM ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  VALUATION COMPOSITE (existing)                               │   │
│  │  valuation_composite ∈ [-2.0, +2.0]                          │   │
│  │  +2.0 = Overvalued/Bubble    -2.0 = Undervalued/Discount    │   │
│  └──────────────────────────┬───────────────────────────────────┘   │
│                             │                                       │
│                             ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  SDCA SIGNAL ENGINE (new)                                     │   │
│  │                                                               │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │   │
│  │  │ Multiplier  │  │   Phase     │  │  Entry/Exit Rules   │  │   │
│  │  │  Function   │  │  Classifier │  │  (composite + trend │  │   │
│  │  │ (piecewise) │  │ (5 zones)  │  │   + percentile)     │  │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │   │
│  │         │                │                     │              │   │
│  │         └────────────────┼─────────────────────┘              │   │
│  │                          ▼                                    │   │
│  │              ┌───────────────────────┐                        │   │
│  │              │   SDCA Signal State   │                        │   │
│  │              │  multiplier, phase,   │                        │   │
│  │              │  action, confidence   │                        │   │
│  │              └───────────┬───────────┘                        │   │
│  └──────────────────────────┼───────────────────────────────────┘   │
│                             │                                       │
│                             ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  PORTFOLIO TRACKER (new)                                      │   │
│  │                                                               │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │   │
│  │  │   Position  │  │    Cost     │  │    Transaction      │  │   │
│  │  │   (BTC)     │  │   Basis     │  │      Log            │  │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │   │
│  │         │                │                     │              │   │
│  │         └────────────────┼─────────────────────┘              │   │
│  │                          ▼                                    │   │
│  │              ┌───────────────────────┐                        │   │
│  │              │  Portfolio Metrics    │                        │   │
│  │              │  unrealized_pnl,      │                        │   │
│  │              │  avg_cost, cash_bal,  │                        │   │
│  │              │  total_fees_paid      │                        │   │
│  │              └───────────┬───────────┘                        │   │
│  └──────────────────────────┼───────────────────────────────────┘   │
│                             │                                       │
│                             ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  VALUATION STUDIO UI (modified)                               │   │
│  │                                                               │   │
│  │  ┌──────────────────────────────────────────────────────┐    │   │
│  │  │  SDCA Panel                                          │    │   │
│  │  │  ┌───────────┬───────────┬───────────┬─────────────┐│    │   │
│  │  │  │ Multiplier│  Phase    │  Action   │  Portfolio  ││    │   │
│  │  │  │  -0.5x    │ EUPHORIA  │  SELL     │  +45.2% PnL ││    │   │
│  │  │  └───────────┴───────────┴───────────┴─────────────┘│    │   │
│  │  │                                                      │    │   │
│  │  │  ┌──────────────────────────────────────────────────┐│    │   │
│  │  │  │  DCA History Chart (Lightweight Charts)          ││    │   │
│  │  │  └──────────────────────────────────────────────────┘│    │   │
│  │  └──────────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Open Questions

1. **DCA frequency**: Should SDCA operate on weekly or daily signals? Daily gives finer control but more noise. Weekly smooths but may miss extremes.
2. **Initial capital**: How to model the starting cash position for backtesting? Fixed $10K? Variable?
3. **Cash reserve**: Should the system enforce a minimum cash reserve (e.g., 10% of portfolio) to maintain dry powder?
4. **Multi-asset**: Future extensibility to altcoins or other assets? Out of scope now but design should not preclude it.
