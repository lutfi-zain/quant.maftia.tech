# Overhaul LTTD and Keep as Quantitative Finance Principle

**Status:** Draft
**Author:** LTTD Quant Team
**Date:** 2026-08-25
**Related:** `v2.1-lttd-72win` (frozen), `isp-signals-btcusd-2026-06-13.csv` (7 trades benchmark)

## Summary

Current LTTD live (`v2.1` `72.22%` `PF21` `hold44d` `25 trades/9.8yr`) behaves as **MTTD-weeks** (smoother 14/10, MHP25, target 21d, 2.57/yr), not true **LTTD** (OU HL 120-350d, hold 90-180d, 0.7-1.2/yr, 7-12 trades as in `isp-signals` 7 trades). Overhaul LTTD to be a **principled quantitative finance system**: causal, walk-forward validated, factor-decomposed, risk-managed, and horizon-coherent — without sacrificing the `72%` robustness.

**Goals:**
- Horizon 120-350d → hold 90-180d median, 0.8-1.2/yr, 8-12 trades / 9.8yr
- Keep `winRate gross ≥65%` (Wilson CI reported), `PF >3`, `sharpeNet >0.9`
- No hardcode: all horizons `= HL × factor`, thresholds `= rolling quantile`, ensemble `pca_consensus` kept
- Quant finance rigor: look-ahead free, WFO, factor strip, cost 10bps, t+1 execution

## Motivation

- Current LTTD vs ISP: 25 vs 7 trades, 44d vs 128d median hold — 3.5x more frequent, not long-term.
- `MTTD` already covers weeks (ER/Entropy). LTTD should cover **months-quarters** to provide orthogonal regime filter (`P(SIDEWAYS)>0.6 → 0.0 exposure` for MTTD/Ichimoku).
- Keep as quant finance principle: Derman “models are metaphors”, Dalio risk parity, Taleb antifragility, Kahneman System 2.

## Scope

**In:**
- `engines/lttd/src/execution/sizing.py` — HL-driven horizons, quantile thresholds
- `engines/lttd/src/data/target_loader.py` — fwd 60-90d, already 21d (extend)
- `engines/lttd/src/signals/base.py` — clamp [50,300]
- `engines/lttd/src/features/*` — VIF/PCA kept, add `FDI` as filter (not feature) if needed
- `engines/lttd/src/regime/hmm.py` — window 21→60, BIC selection for k=2..4
- `scripts/autoresearch_lttd_benchmark_v2.py` — new LTTD-L window 2016-2026, 60d fwd

**Out:**
- MTTD, Ichimoku, Valuation (only interface via circuit breaker)
- UI redesign (only metrics)

## Alternatives Considered

- Keep `LTTD-M` 25 trades as is and label as MTTD — rejected, need true LTTD for macro filter.
- Build separate `LTTD-L` new system — considered, but overhaul in place with WFO keeps `v2.1` as fallback.

## Risks

- `n=8-12` → Wilson CI 40-90% for 70% win — must report CI, not point.
- PF will drop 21→4-5 (longer hold, fewer trades) — acceptable if expectancy stays >15%.
- HMM window 60 may not converge — fallback to 21 with warning.

## Success Criteria

- `autoresearch.sh` LTTD-L window `2016-2026` `winRate≥65%` `PF>3` `trades 8-12` `hold 90-180d` `WFO OOS Sharpe>0.7`
- Factor strip `R²<0.5` `alpha t>2.0`
