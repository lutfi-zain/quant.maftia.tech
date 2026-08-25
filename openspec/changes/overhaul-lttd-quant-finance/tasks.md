# Tasks: Overhaul LTTD Quant Finance

## Phase 0 — Baseline & Guards
- [x] 0.1 Re-run V2 harness on 2016-2026 window, log Wilson CI for 25 trades 76% (1/1) — baseline 2016-2026: 22 trades 68.18% (15/22) PF15.6 hold44 sharpe1.44 Wilson 46-84% (actual 2015-2025: 25 trades 76% PF22.3 Wilson 56-89%)
- [x] 0.2 Run `scripts/validate.py` QV-001..010 on `sizing.py` `target_loader.py` — fix bfill/hardcode — sizing.py ✅ no issues, target_loader.py bfill fixed (ffill only), remaining 3 CRITICAL are false positives for target file (shift(-21) is target purged 21d, cost/WFO belong in runner)
- [x] 0.3 Factor strip `strategy ~ BTC + SMA_dist + vol` → report `R²` `alpha t` — 2018-2024: R² 0.498 (unexplained 0.50), mkt beta 0.49 t47.3, SMA_dist 0.003 t3.3, vol 0.007 t0.30, alpha 6.58% ann t0.31 → NO_ALPHA (t<2, R²<0.5), Sharpe 1.36 annRet 62.6%

## Phase 1 — Horizon Coherence (HL-driven)
- [ ] 1.1 `sizing.py`: HL-driven smoother 30/20, MHP 60-90, RCO 30-45, MA 250, SCORE quantile 65/35 (750d)
- [ ] 1.2 `target_loader.py`: fwd 60d (and 90d variant), tail 60, align 60, validate 60
- [ ] 1.3 `signals/base.py`: clamp [50,300] (was [10,400])
- [ ] 1.4 `regime/hmm.py`: window 60, BIC k=2..4 selection

## Phase 2 — WFO & Cost
- [ ] 2.1 `backtest/runner.py` + `backtest/wfo.py`: embargo 60d (was 14), purge 60
- [ ] 2.2 Ensure `t+1` `Active_Pos[i]=pos[i-1]` already, add `fee 10bps` gross vs net reporting
- [ ] 2.3 Run WFO 7 folds, report IS/OOS Sharpe decay, HLZ deflated Sharpe >2.0

## Phase 3 — Benchmark & Verification
- [ ] 3.1 `benchmark_v2.py` LTTD-L window 2016-2026, expect 8-12 trades, hold 90-180, win≥65% PF>3
- [ ] 3.2 `verify_lttd_studio_metrics_1to1.py` 1:1 parity
- [ ] 3.3 Keep `v2.1` LTTD-M as fallback behind feature flag `LTTD_MODE`

## Phase 4 — Release
- [ ] 4.1 Tag `v3.0-lttd-long` + release notes with winRate CI, PF, hold, WFO OOS
- [ ] 4.2 Update `docs/02_quant_btc_lttd_system.md` + `UNIFIED_SYSTEM_ARCHITECTURE.md`
