## Context

See `proposal.md` for background.

Currently, `compute_sdca_backtest()` in Python and TypeScript deploys `amount_to_buy = min(cash, base_dca_amount * multiplier)`. When cash is $10,000 at inception, $150–$300 is 1.5%–3.0%. But when cash grows to $500,000+ after cycle top sales, $300 is only 0.06%, causing 99.94% cash drag.

## Goals / Non-Goals

**Goals:**
- Update `compute_sdca_backtest()` in Python (`engines/valuation/quant/sdca/backtest.py`) and TypeScript (`src/lib/sdcaBacktest.ts`, `web/src/lib/sdcaBacktest.ts`) to use proportional cash allocation:
  ```python
  dca_cash_pct = config.get("dca_cash_pct", 0.08)
  amount = min(cash, max(base_dca_amount, cash * min(1.0, dca_cash_pct * multiplier)))
  ```
- Implement proportional position selling in `DCA_OUT`:
  ```python
  sell_frac = 0.15 if comp_t1 <= -1.5 else 0.08
  btc_to_sell = btc * sell_frac
  ```
- Ensure 100% 1:1 metric parity between Python and TypeScript.

**Non-Goals:**
- No changes to UI components or chart layout.

## Decisions

### Decision 1: Proportional Cash Deployment Formula
In both Python and TypeScript:
```typescript
const dcaCashPct = config.dca_cash_pct ?? 0.08;
const targetAmount = sdcaCash * Math.min(1.0, dcaCashPct * multiplier);
const amountToBuy = Math.min(sdcaCash, Math.max(baseDcaAmount, targetAmount));
```

### Decision 2: DCA_OUT Fraction Sizing
```typescript
const sellFrac = comp_t1 <= -1.5 ? 0.15 : 0.08;
const btcToSell = sdcaBtc * sellFrac;
```

## Risks / Trade-offs

- **Faster Cash Depletion in Extended Bear Markets**: Deploying 12%–24% of cash per week means cash is deployed over ~12–20 weeks of accumulation. This matches historical Bitcoin bottom zones (3–6 months of deep discount) and achieves mathematically optimal cost basis.
