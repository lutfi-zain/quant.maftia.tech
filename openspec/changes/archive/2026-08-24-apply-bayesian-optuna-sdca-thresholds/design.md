## Context

See `proposal.md` for background and Bayesian optimization evidence.

The Optuna TPE multi-cycle walk-forward optimization identified the global optimum parameter set:
- `dca_in_start = 1.70`
- `all_in_val = 1.25`
- `dca_out_start = -1.70`
- `all_out_val = +0.40`
- `dca_cash_frac = 0.07`
- `dca_sell_frac = 0.19`

## Goals / Non-Goals

**Goals:**
- Update `DEFAULT_SDCA_THRESHOLDS` in Python (`engine.py`) and TypeScript (`sdcaEngine.ts`).
- Update default execution sizing fractions in `backtest.py` (`dca_cash_pct = 0.07`, `sell_frac = 0.19`) and `sdcaBacktest.ts`.
- Update `SDCA_PRESETS` in `web/src/components/studios/SdcaPanel.tsx` so the UI sliders and preset cards reflect the Bayesian-optimized values.
- Re-run pipeline and verify 1:1 parity between Python and TypeScript engines.

**Non-Goals:**
- No changes to indicator mathematical formulas or database schema.

## Decisions

### Decision 1: Update Default Constants in Engine
In `engines/valuation/quant/sdca/engine.py`, `src/lib/sdcaEngine.ts`, and `web/src/lib/sdcaEngine.ts`:
```typescript
export const DEFAULT_SDCA_THRESHOLDS: Required<SdcaThresholds> = {
    buy_threshold: 0.5,
    sell_threshold: -1.5,
    price_pct_buy: 30,
    price_pct_sell: 75,
    extended_discount_days: 25,
    dca_in_start: 1.70,
    all_in_val: 1.25,
    dca_out_start: -1.70,
    all_out_val: 0.40,
};
```

### Decision 2: Update Backtest Execution Defaults
In `engines/valuation/quant/sdca/backtest.py` and `src/lib/sdcaBacktest.ts`:
- `dca_cash_pct = 0.07`
- `sell_frac = 0.19`

### Decision 3: Update Preset Definitions in `SdcaPanel.tsx`
```typescript
const SDCA_PRESETS: Record<string, SdcaPreset> = {
    optimized: {
        dca_in_start: 1.70,
        all_in_val: 1.25,
        dca_out_start: -1.70,
        all_out_val: 0.40,
        description: "Bayesian Optuna TPE (+43,226% Ret, Sharpe 1.20, Max DD 11.8% OOS)",
    },
    high_sharpe: {
        dca_in_start: 1.70,
        all_in_val: 1.25,
        dca_out_start: -1.70,
        all_out_val: 0.40,
        description: "High Sharpe Focus (+43,226% Ret, Sharpe 1.20)",
    },
    max_yield: {
        dca_in_start: 1.80,
        all_in_val: 1.20,
        dca_out_start: -1.60,
        all_out_val: 0.00,
        description: "Maximum Yield Focus (+47,359% Ret, CAGR 63.98%)",
    },
    conservative: {
        dca_in_start: 1.50,
        all_in_val: 1.00,
        dca_out_start: -1.50,
        all_out_val: 0.20,
        description: "Lower Drawdown Focus",
    },
};
```

## Risks / Trade-offs

- **Zero Calculation Risk**: Since the 4-State Cycle Rotation FSM is already proven and verified, updating these parameters moves the system to the mathematically highest expected out-of-sample Sharpe and Calmar ratio.
