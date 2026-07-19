Now I have all the evidence needed for a thorough review. Let me compile my findings.

## Review: SDCA Strategy Engine — CRISP-DM / Data Science Core Analysis

---

### Phase 1: Business Understanding — "Are we asking the right question?"

**The core question is sound:** Can modulating DCA allocation based on the valuation composite improve risk-adjusted returns versus simple DCA or the current binary threshold? This is a legitimate business question with measurable outcomes.

**However, there is a BLOCKER on the foundational premise.**

---

### 🚨 BLOCKER: Sign Convention Inversion Between Proposal and Existing System

The proposal states (proposal.md):
> "When composite > +1.0 (deep value): Forward 180d return averages +55% to +75%"

The SDCA multiplier table (spec.md) maps:
- `composite > 1.5` → **3.0x multiplier** (Deep Value → Aggressive Buy)
- `composite ≤ -1.0` → **-0.5x multiplier** (Euphoria → Sell)

**But the existing system has the exact OPPOSITE sign convention:**

| Source | File | Convention |
|--------|------|------------|
| Valuation Architecture | `docs/01_quant_btc_valuation_system.md:L113-115` | `-2.0` = Very Undervalued, `+2.0` = Very Overvalued |
| Circuit Breakers API | `src/api/routes/circuit-breakers.ts:L30-31` | `bubble_warning` at `≥ +1.50`, `deep_discount` at `≤ -1.00` |
| Daily API | `src/api/routes/daily.ts:L55-56` | `bubble_warning: valScore >= 1.5`, `deep_discount: valScore <= -1.0` |
| Existing Backtest | `web/src/components/studios/ValuationStudio.tsx:L252` | `score >= 1.50 ? 0 : 1` (cash when high, long when low) |
| Color Mapping | `docs/01_quant_btc_valuation_system.md:L113-115` | Red/Overvalued at `+2.0`, Green/Undervalued at `-2.0` |

**Impact:** If implemented as specified, the SDCA engine will **buy aggressively when the system says "bubble risk"** and **sell when the system says "deep discount."** This is a catastrophic logic inversion.

**Resolution required:** Either:
1. **(A) Flip the SDCA sign convention** so that composite ≤ -1.5 = Deep Value (3.0x buy) and composite ≥ +1.0 = Euphoria (sell), OR
2. **(B) Negate the composite before feeding into SDCA** (i.e., `sdcaInput = -valuation_composite`), OR
3. **(C) If the proposal's forward-return claims are correct** (high composite → positive forward returns), then the existing valuation system's sign convention itself needs reconciliation — which is a much larger scope change.

Option (A) or (B) are the safe paths. The proposal must be corrected before any implementation begins.

---

### Phase 2: Data Understanding — "Is the data sufficient and quality?"

**What's good:**
- The `valuation_composite` is a well-defined, already-ingested signal with 17 indicators across 3 pillars
- Data lineage is clear: `master_ohlcv` → valuation pipeline → `unified_daily_analytics`
- Historical range (2015–2026) covers multiple BTC cycles

**Concerns identified:**

1. **Composite data quality at boundaries:** The proposal relies on composite values at extremes (±1.0, ±1.5). Need to verify how frequently the composite actually reaches these values. If the composite spends most time in [-0.5, +0.5], the SDCA engine will rarely fire actionable signals, making it a complex system that behaves like simple DCA most of the time.

2. **The "historical analysis" claims lack provenance:** The proposal cites "Composite > +1.0 → Forward 180d return averages +55% to +75%" but provides no source code, notebook, or data file for this analysis. This is a critical gap — the entire strategy rests on these numbers.

3. **Price percentile uses a 365-day rolling window** (spec.md cycle phase detection). This creates a lookback dependency: the phase classifier needs 365 days of history before it can compute percentiles. The first year of the backtest will have undefined phase classification. **Spec.md does not address this cold-start period.**

4. **Composite trend detection** uses 7-day vs 30-day moving averages. With daily data, these are reasonable, but the 7-day MA is noisy. Consider whether a longer short-window (e.g., 14-day) would reduce false signals.

---

### Phase 3: Data Preparation — "Are there data leakage risks?"

**Causal filtering is explicitly specified** (spec.md Requirement: Causal Filtering), which is good. The spec mandates t-1 execution boundary. However:

1. **Phase detection has a subtle leakage risk:** The cycle phase detection uses `price percentile (rolling 365-day)` and `composite trend (7-day vs 30-day MA)`. Both are backward-looking, which is correct. But the spec should explicitly state that the price percentile for day `t` uses only prices through day `t-1` (not including `t`). The current wording "rolling 365-day" is ambiguous about whether today's price is included.

2. **The DCA Entry Rule** requires `valuation_composite crosses above +1.0 from below`. This cross detection itself is causal (comparing today's composite to yesterday's), which is correct. But the spec should clarify: does "crosses above" mean `composite[t-1] < threshold AND composite[t] >= threshold` (using t-1 data only) or something else?

3. **Multi-signal entry rule** combines composite + price percentile + trend. All three must be satisfied simultaneously. This is a high bar that may rarely trigger. Consider whether the spec should document the expected frequency of entry signals across historical data.

4. **Portfolio tracker persistence via localStorage** is specified but has a data quality concern: localStorage is origin-bound and cleared by the user. If the user clears browser data, the entire portfolio history is lost. The spec should mention this limitation and whether the transaction log is the source of truth (recoverable) or the derived state (not recoverable).

---

### Phase 4: Modeling — "Is the modeling approach appropriate?"

**The piecewise linear approach is reasonable** (Decision 1 in design.md). It's interpretable, tunable, and avoids cliff effects. Good choice.

**However, several modeling concerns exist:**

1. **Missing baseline comparison in the spec:** The proposal mentions "SDCA vs Simple DCA vs Buy & Hold" (design.md Goals), but the spec files do not define the **Simple DCA baseline implementation**. The backtest extension (task 6.2) mentions comparison metrics, but the spec doesn't say:
   - What is the fixed DCA amount for Simple DCA?
   - What frequency (daily/weekly)?
   - Is the Simple DCA truly naive (fixed amount, fixed interval) or does it use any signal?

2. **The SDCA multiplier range [-0.5x, +3.0x] is asymmetric and aggressive.** A 3x multiplier means buying 3x the normal amount when the composite says "deep value." This requires significant cash reserves. The spec addresses insufficient cash (portfolio tracker spec), but doesn't model the opportunity cost of holding large cash reserves to fund the 3x purchases. **How much idle cash is expected as a percentage of portfolio over the backtest period?**

3. **The sell logic uses `abs(multiplier)` as a percentage of holdings to sell** (portfolio tracker spec: "sellPct = abs(multiplier) — e.g., -0.5x = 50% of holdings"). But the spec says the exit rule recommends "sell 10% of holdings per week" or "sell 100% of holdings." These are NOT the same as the multiplier value. There's a disconnect between the multiplier function (continuous) and the exit rules (discrete percentages). The spec needs to clarify: **does the multiplier directly control sell percentage, or do the exit rules override the multiplier?**

4. **No out-of-sample validation strategy is defined.** The design.md mentions "out-of-sample validation" as a risk mitigation for overfitting, but there's no specification for how this works. For a 2015–2026 dataset, a proper approach would be:
   - Train/validate on 2015–2022 (tune multiplier thresholds)
   - Test on 2023–2026 (out-of-sample)
   - Or use walk-forward validation

5. **The backtest engine extension** (task 6.1) needs to handle continuous position sizing differently from the current binary (-1, 0, +1) system. The current `useStudioBacktest` computes `stratRet = activePos * marketRet - tc` where `activePos` is binary. For SDCA, `activePos` would be a continuous multiplier. The Sharpe ratio calculation uses daily returns which compound differently for continuous vs binary positions. **The spec doesn't address how the existing Sharpe/metrics calculation adapts to continuous position sizing.**

---

### Phase 5: Evaluation — "Are we evaluating against the right metrics?"

**The metrics in the existing backtest engine are appropriate** (Sharpe, max drawdown, win rate, profit factor). But:

1. **Missing key DCA-specific metrics:** For a DCA strategy, the most important metrics are:
   - **Cost basis advantage:** How much lower is the SDCA average cost vs Simple DCA?
   - **Accumulation efficiency:** Total BTC accumulated per dollar invested
   - **Time-in-market:** Percentage of time with active position
   - **Maximum cash drag:** Peak cash reserve as % of portfolio (opportunity cost)
   
   None of these are in the spec's portfolio metrics calculation.

2. **The proposal claims business impact** ("measurable edge over naive DCA") but the spec doesn't define what "measurable edge" means quantitatively. Is it:
   - Higher Sharpe ratio? (by how much?)
   - Lower max drawdown? (by how much?)
   - Higher total return? (by how much?)
   - Better cost basis? (by how much?)
   
   The acceptance criteria for the backtest comparison (task 7.2) should specify minimum improvement thresholds.

3. **No sensitivity analysis is specified.** The piecewise linear function has 7 breakpoints. How sensitive are the results to small changes in these breakpoints? A ±0.1 shift in any threshold should be tested to ensure the strategy isn't fragile.

---

### Phase 6: Deployment — "Is this deployable and monitorable?"

**Deployment is well-scoped** — client-side TypeScript, no new API endpoints, no database changes. The localStorage persistence is pragmatic for advisory signals.

**Concerns:**

1. **No monitoring or drift detection:** The proposal mentions "Monitor composite stability; add regime staleness alert if composite > 1.0 for > 180 days without price drop" (design.md Risks), but this is not specified in any spec file. Who/what triggers this alert? Where does it display?

2. **The Python engine path `engines/valuation/quant/sdca/`** is listed in proposal.md's Affected Code, but the design.md and specs all describe a TypeScript client-side implementation. This is confusing — is there a Python component or not? The proposal should be consistent.

3. **No A/B testing or gradual rollout strategy.** Since this is advisory (no real money), the risk is low, but users who adopt the SDCA view will see different metrics than the existing binary backtest. There should be a clear way to compare both views side-by-side.

---

### Summary of Feature Engineering Opportunities Missed

1. **Regime-conditioned multipliers:** The SDCA multiplier is purely a function of the valuation composite. But the LTTD regime (BULL/BEAR/SIDEWAYS) is already available. Multiplier adjustment based on regime (e.g., higher multiplier in BEAR regime when composite is high) could improve signal quality.

2. **Volatility-adjusted sizing:** The current multiplier doesn't account for market volatility. In high-volatility environments, even "deep value" signals can be wrong. A volatility scaling factor (using the existing 20-day volatility from LTTD) would reduce risk.

3. **Time-decay on euphoria signals:** The exit rule mentions "composite < -0.5 for > 30 consecutive days" as extended euphoria. But a more sophisticated approach would use the rate of composite decline, not just duration.

---

## Review

- **Correct:** The overall architecture (piecewise linear, client-side, extending existing backtest) is sound. The causal filtering requirement is explicitly stated. The collapsible panel design respects the existing chart ecosystem (85px Y-axis lock, crosshair sync).

- **Blocker:** `proposal.md:L11-13` and `specs/sdca-strategy-engine/spec.md:L1-22` — **Sign convention inversion.** The proposal treats high composite as "deep value" and low composite as "euphoria," but the existing system (confirmed in `src/api/routes/circuit-breakers.ts:L30-31`, `src/api/routes/daily.ts:L55-56`, `docs/01_quant_btc_valuation_system.md:L113`) treats high composite as "overvalued/bubble" and low as "undervalued/deep discount." Implementing as-specified would invert all signals, buying at tops and selling at bottoms.

- **Blocker:** `specs/sdca-strategy-engine/spec.md` and `specs/sdca-portfolio-tracker/spec.md` — **Multiplier-vs-exit-rule conflict.** The exit rules recommend discrete percentages (10%/week, 100% lump sum), but the sell execution spec says `sellPct = abs(multiplier)`. These can produce contradictory sell amounts. The spec must clarify which takes precedence.

- **Note:** `proposal.md:L11-13` — Historical forward-return claims (+55% to +75% when composite > +1.0) lack provenance. These numbers underpin the entire strategy but have no source notebook, data file, or reproduction script. Before implementation, this analysis must be reproduced and documented.

- **Note:** `specs/sdca-strategy-engine/spec.md` Cycle Phase Detection — 365-day rolling price percentile creates a cold-start gap. First ~1 year of backtest will have undefined phases. Spec should address initialization behavior.

- **Note:** `specs/sdca-portfolio-tracker/spec.md` Portfolio Metrics — Missing DCA-critical metrics: cost basis advantage vs Simple DCA, accumulation efficiency, cash drag. Without these, users cannot evaluate whether SDCA actually adds value.

- **Note:** `design.md` vs `proposal.md` — `proposal.md` lists `engines/valuation/quant/sdca/` (Python) in Affected Code, but all specs describe TypeScript client-side implementation. Inconsistency should be resolved.

- **Note:** Missing out-of-sample validation strategy. The design.md acknowledges overfitting risk but provides no spec for train/test split or walk-forward validation.