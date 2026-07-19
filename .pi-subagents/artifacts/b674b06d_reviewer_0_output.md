I now have all evidence needed for a comprehensive review. Let me compile my findings.

---

## Review: SDCA Strategy Engine — Radical Skepticism Audit

### 1. BLOCKER: Critical Sign Convention Inversion

**Severity: CRITICAL / BLOCKER**

This is the single most important finding. The SDCA proposal has **inverted the entire sign convention** of the valuation composite, which would cause the strategy to buy at tops and sell at bottoms — the exact opposite of its stated intent.

**Evidence chain:**

1. **Existing Valuation Studio** (`web/src/components/studios/ValuationStudio.tsx:243`):
   ```ts
   const pos = score >= 1.50 ? 0 : 1;
   ```
   The existing system treats `score >= +1.50` as **BUBBLE** → go to CASH. The system is **long when composite is low**, **cash when composite is high**.

2. **Chart annotation labels** (`ValuationStudio.tsx:450-458`):
   - `+1.50` → "Bubble +1.50" (rendered in RED)
   - `-1.00` → "Discount -1.00" (rendered in GREEN)

3. **Normalization function** (`engines/valuation/quant/components/normalization.py:46`):
   - `t_plus_2` threshold → normalized to `+2.0` = "Extreme **Undervalued**" (bottom/green)
   - `t_minus_2` threshold → normalized to `-2.0` = "Extreme **Overvalued**" (top/red)
   - **Positive composite = undervalued/discount. Negative composite = overvalued/expensive.**

4. **Circuit Breaker API** (`src/api/routes/circuit-breakers.ts:38-49`):
   - `bubble_warning`: active when `score >= +1.50` → "Trigger macro take-profit defense filter"
   - `deep_discount_override`: active when `score <= -1.00` → "Trigger macro accumulation defense filter"

5. **Architecture docs** (UNIFIED_SYSTEM_ARCHITECTURE.md, MASTER_ROADMAP.md):
   - `>= +1.50` = "macro bubble risk / top-of-cycle danger zone" → restrict new long exposure
   - `<= -1.00` = "deep discount accumulation regime" → boost exposure

**The SDCA spec inverts everything:**

| SDCA Proposal | Actual System Meaning | SDCA Action | Correct Action |
|---|---|---|---|
| composite > +1.5 → 3.0x multiplier "Deep Value" | Overvalued/Bubble zone | **Aggressive BUY** ❌ | Should **SELL/REDUCE** |
| composite > +1.0 → 2.0x multiplier "Value" | Moderately overvalued | **BUY** ❌ | Should **REDUCE** |
| composite > 0.0 → 1.0x multiplier "Fair" | Neutral | Normal DCA | Normal DCA ✓ |
| composite < -0.5 → 0.0x multiplier "Expensive" | Approaching deep discount | **PAUSE** ❌ | Should **BUY** |
| composite ≤ -1.0 → -0.5x multiplier "Euphoria" | Deep discount zone | **SELL** ❌ | Should **AGGRESSIVE BUY** |

**Impact:** If implemented as specified, this strategy would allocate 3x normal investment at Bitcoin cycle tops (when everyone is euphoric) and stop buying at bottoms (when assets are deeply discounted). This is the antithesis of value investing and would catastrophically underperform naive DCA.

**Additionally**, the proposal's own justification text is internally contradictory:
- Proposal states: *"When composite > +1.0 (deep value): Forward 180d return averages +55% to +75%"*
- But the existing system says `composite >= +1.50` = BUBBLE RISK → restrict longs

The forward-return claims are mathematically impossible under the existing normalization — a composite of +1.0 means indicators are near their "undervalued" extremes, which historically occur at price bottoms, not when future returns are +55% (that happens from tops going further up in a bull run, not from bottoms). The author appears to have confused "high composite" with "high price."

**Recommendation:** The multiplier table must be **completely inverted**:
- High composite (+1.5 to +2.0) → SELL / reduce allocation
- Low composite (-1.0 to -2.0) → AGGRESSIVE BUY

Or alternatively, if the intent was to use a different signal, the proposal must specify which alternative metric it's actually using, and justify why it diverges from the existing system's sign convention.

---

### 2. Walk-Forward Validation Gap

**Severity: HIGH**

The design document mentions *"out-of-sample validation"* once in the risks table as a mitigation for overfitting, but:
- **No spec requirement mandates walk-forward testing**
- **No task requires out-of-sample validation** (tasks.md only says "verify SDCA engine produces correct signals for historical data 2015-2026" — all in-sample)
- **No train/test split methodology is defined**
- **No rolling window or expanding window validation is specified**

The lz-quant-researcher mindset demands: if you tuned piecewise thresholds on 2015-2026 data, show me performance on data you haven't seen. The spec has zero requirements for this.

**Recommendation:**
- Add a **walk-forward validation requirement** to `sdca-strategy-engine/spec.md`:
  - Training window: configurable (e.g., 3 years rolling)
  - Out-of-sample testing: minimum 6 months forward
  - Performance must be reported per fold
  - Add to tasks.md: "Implement walk-forward validation with configurable train/test split"

---

### 3. Transaction Cost Blindness

**Severity: MEDIUM-HIGH**

- The backtest engine (`studioBacktest.ts:207-208`) already charges `feeRate` per position change: `tc = Math.abs(activePos - prevActivePos) * feeRate`
- But the **SDCA spec has zero mention of transaction costs** in portfolio tracker requirements
- SDCA triggers frequent rebalancing (multiplier changes → position changes → trades), which will compound costs
- No slippage modeling, no market impact modeling, no spread modeling

**The Haircut Rule applies:** SDCA trades ~7x more frequently than binary strategy (7 zones vs 2 states). Even with 10 bps per trade, the cumulative drag on a DCA strategy could be substantial.

**Recommendation:**
- Add transaction cost parameter to portfolio tracker spec (default: 10 bps per trade)
- Include total fees paid in portfolio metrics
- Require fee-adjusted vs fee-free comparison in backtest results

---

### 4. Overfitting Risk — Piecewise Threshold Tuning

**Severity: MEDIUM-HEDIUM**

The 7-zone piecewise function uses specific thresholds (`+1.5`, `+1.0`, `+0.5`, `0.0`, `-0.5`, `-1.0`) with specific multipliers (`3.0x`, `2.0x`, `1.5x`, `1.0x`, `0.5x`, `0.0x`, `-0.5x`). These appear to be "round numbers" rather than statistically derived. 

But the real question is: **were these calibrated on historical data?** The proposal says "Historical analysis (2015–2026) reveals..." suggesting the thresholds were fitted to this exact dataset. Without walk-forward validation (see finding #2), we cannot distinguish signal from noise.

**Additional overfitting signals:**
- The entry rule requires 3 simultaneous conditions (composite crossing + price percentile + trend) — a multi-condition gate that could be a form of data snooping
- The exit rule has 3 different triggers — could be curve-fit to specific historical exits

**Recommendation:**
- Parameterize all thresholds as configurable inputs with documented defaults
- Require sensitivity analysis showing performance under ±20% threshold variation
- Document which historical periods informed each threshold

---

### 5. Regime Blindness — Acknowledged but Unaddressed

**Severity: MEDIUM**

The design doc acknowledges *"Regime blindness: Composite assumes mean reversion; new regime (post-ETF) may not follow historical patterns"* and suggests a mitigation: *"Monitor composite stability; add regime staleness alert if composite > 1.0 for > 180 days without price drop."*

But this mitigation:
1. Is not specified in any spec requirement
2. Is not included in any task
3. Is vague ("staleness alert" — what action does it trigger?)
4. Doesn't address the fundamental problem: **if the composite's predictive power degrades in a new regime, the entire multiplier function becomes noise**

**Recommendation:**
- Add a **regime confidence metric** to the SDCA signal output
- Define a **circuit breaker** for when the composite signal has been directionally wrong for N consecutive months
- Specify a **maximum allocation** cap during regime uncertainty periods

---

### 6. Factor Decomposition Concern

**Severity: MEDIUM**

The SDCA strategy's "alpha" may be entirely explained by:
- **Time-in-market beta**: Simply being long Bitcoin during accumulation periods captures the crypto market's structural uptrend
- **Rebalancing premium**: Any mean-reversion strategy on a trending asset generates apparent alpha through regular rebalancing

The proposal compares SDCA to "naive DCA" but doesn't compare to:
- Simple buy-and-hold
- DCA with fixed 1.0x multiplier (no signal-based adjustment)
- Random DCA timing

Without these baselines, we cannot determine if the composite signal adds any value over mechanical rebalancing.

**Recommendation:**
- Task 6.2 should require comparison metrics vs: buy-and-hold, fixed DCA, and random-timing DCA
- Report information ratio (alpha / tracking error) not just Sharpe

---

### 7. Capacity Limits Not Addressed

**Severity: LOW-MEDIUM**

The spec doesn't discuss:
- Maximum portfolio size before market impact becomes material
- Whether the strategy is viable for different capital scales ($100/week vs $10,000/week)
- Liquidity assumptions for the -0.5x sell signal (can you always sell BTC at the marked price?)

For a $100/week DCA, this is academic. For larger allocations, the 3.0x multiplier at tops (if signs were corrected) or bottoms could create slippage.

---

### 8. Client-Side Architecture Concerns

**Severity: LOW-MEDIUM**

Decision 2 (client-side computation) and Decision 3 (localStorage persistence) are pragmatic but introduce:
- **Portfolio state loss**: localStorage is per-browser, per-device. Users lose portfolio history on cache clear, incognito mode, or device switch.
- **No audit trail**: Advisory signals with no backend persistence means no way to verify historical recommendations
- **No multi-device sync**: Users on desktop and mobile see different portfolio states

This is acceptable for an advisory system but should be documented as a known limitation.

---

### 9. Minor Spec Issues

- **Sell execution spec** (`sdca-portfolio-tracker/spec.md`): The `sellPct = abs(multiplier)` interpretation means -0.5x = sell 50% of holdings per period. This is extremely aggressive. A -0.5x multiplier should mean "sell 50% of the DCA allocation amount worth of holdings" or "reduce position by 50%", not "sell half of all BTC." The spec should clarify.
- **Phase detection overlaps**: The phase detection table has gaps (e.g., composite > -0.5, price < 60%, no trend specified = "Expansion" is the only option, but what if composite = -0.6, price = 75% percentile?). Phase detection needs exhaustive coverage or explicit fallback.
- **Backtest task 6.5** says "Verify t-1 causal enforcement" but doesn't define HOW (no test procedure specified).

---

## Top 3 Risks That Could Cause This Strategy to Fail in Production

| # | Risk | Impact | Likelihood | Evidence |
|---|------|--------|------------|----------|
| **1** | **Sign Convention Inversion** — Strategy buys at tops, sells at bottoms | Catastrophic (100% capital loss potential) | 100% if implemented as-is | proposal.md multiplier table is inverted vs normalization.py sign convention |
| **2** | **Regime Breakdown** — Composite's predictive power fails in post-ETF or post-halving regime | Strategy underperforms naive DCA significantly | Medium-High (regime breaks have occurred: 2020, 2024 ETF approval) | design.md acknowledges but specs don't address |
| **3** | **Overfitting** — Thresholds tuned on 2015-2026 in-sample data, no out-of-sample validation | False confidence in strategy edge, real-time performance divergence | Medium-High (no walk-forward required) | No OOS validation in specs or tasks |

---