# Design: LTTD Overhaul — Quantitative Finance Principle

## Architecture

```
OU HL (150-250) ──► dynamic_lookback ──► all horizons = HL × factor
  │                    │                    │
  ├─ HL×0.15 → smoother 30/20 (was 14/10)
  ├─ HL×0.30 → MHP 60-90 (was 25)
  ├─ HL×0.15 → RCO 30-45 (was 14)
  ├─ HL×0.30 → target fwd 60-90d (was 21d)
  ├─ HL×0.30 → HMM window 60 (was 21)
  └─ HL×1.25 → VIF/PCA window 250-300 (was 252)
```

**No hardcode:** `SCORE_ENTRY = quantile(smoothed_score, 65, 750d)` not `0.28`.

## Quant Finance Guards

- **Causal:** `merge_asof backward`, `shift(+60)`, `reindex ff ill` only up to `t-60`, purge 60d.
- **WFO:** `1095/180/180` already, add `embargo 60d` (currently 14). Report `IS vs OOS Sharpe decay` and `deflated Sharpe (HLZ)`.
- **Factor strip:** `strategy_ret ~ BTC + SMA_dist + vol + MVRV` → need `alpha t>2.0`, `R²<0.5`.
- **Cost:** `10 bps` per flip already, add `t+1` execution (`Active_Pos[i]=pos[i-1]` already), report `gross vs net winRate`.
- **Risk:** `maxDD`, `VaR 5%`, `Kelly f=0.5` half-Kelly sizing, `P(SIDEWAYS)>0.6 → 0`.

## Data Flow

```
master_ohlcv (4552 rows) → ohlcv_pipeline → feature matrix (6 tech + 8 onchain_roc)
  → VIF 10 prune → CausalPCA 0.85 (keep, FDI as filter) → pca_consensus (keep)
  → HMM 60d (diag, BIC k=2..4) → posteriors → sizing (HL-driven)
  → WFO 7 folds → metrics (winRate, PF, hold, Sharpe, Wilson CI)
```

## Benchmark

`autoresearch.sh` LTTD-L: `START 2016-01-01 END 2026-08-25` `fee 10` `pca_consensus` `window60` `target60` `MHP60` → expect `8-12` trades, `hold 90-180`.

## Alternatives

- Keep `LTTD-M` 25 trades as is (v2.1) and create `LTTD-L` new file `sizing_long.py` — chosen to keep v2.1 as fallback, overhaul creates `sizing.py` HL-driven but with feature flag `LTTD_MODE=long|medium`.

## Verification

- `bash autoresearch.sh` → `winRate≥65%` `PF>3` `trades 8-12` `hold 90-180`
- `verify_lttd_studio_metrics_1to1.py` → `winRate` `PF` `sharpe` match API within `1e-6`
- `scripts/validate.py` QV-001..010 pass (no bfill, no hardcode dates)
