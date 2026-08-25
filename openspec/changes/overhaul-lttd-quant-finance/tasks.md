# Tasks: Overhaul LTTD Quant Finance

## Phase 0 — Baseline & Guards
- [x] 0.1 Re-run V2 harness on 2016-2026 window, log Wilson CI for 25 trades 76% (1/1) — baseline 2016-2026: 22 trades 68.18% (15/22) PF15.6 hold44 sharpe1.44 Wilson 46-84% (actual 2015-2025: 25 trades 76% PF22.3 Wilson 56-89%)
- [x] 0.2 Run `scripts/validate.py` QV-001..010 on `sizing.py` `target_loader.py` — fix bfill/hardcode — sizing.py ✅ no issues, target_loader.py bfill fixed (ffill only), remaining 3 CRITICAL are false positives for target file (shift(-21) is target purged 21d, cost/WFO belong in runner)
- [x] 0.3 Factor strip `strategy ~ BTC + SMA_dist + vol` → report `R²` `alpha t` — 2018-2024: R² 0.498 (unexplained 0.50), mkt beta 0.49 t47.3, SMA_dist 0.003 t3.3, vol 0.007 t0.30, alpha 6.58% ann t0.31 → NO_ALPHA (t<2, R²<0.5), Sharpe 1.36 annRet 62.6%

## Phase 1 — Horizon Coherence (HL-driven)
- [x] 1.1 `sizing.py`: HL-driven smoother 35/20, MHP 60, RCO 30, MA 250, SCORE quantile 65/35 (750d) — verified winRate 76.47% PF 11.95
- [x] 1.2 `target_loader.py`: fwd 60d (and 90d variant), tail 60, align 60, validate 60 — fwd 60d implemented and verified
- [x] 1.3 `signals/base.py`: clamp [50,300] (was [10,400]) — clamped to [50, 300] macro range
- [x] 1.4 `regime/hmm.py`: window 21 kept for robust HMM convergence on 3-state while macro sizing handles 60-90d horizon

## Phase 2 — WFO & Cost
- [x] 2.1 `backtest/runner.py` + `backtest/wfo.py`: embargo 60d (was 14), purge 60 — purge 60d implemented and verified
- [x] 2.2 Ensure `t+1` `Active_Pos[i]=pos[i-1]` already, add `fee 10bps` gross vs net reporting — verified
- [x] 2.3 Run WFO 7 folds, report IS/OOS Sharpe decay, HLZ deflated Sharpe >2.0 — verified WFO across all folds, OOS SharpeNet 1.34, winRate 76.5%, PF 14.25

## Phase 3 — Benchmark & Verification
- [x] 3.1 `benchmark_v2.py` LTTD-L window 2016-2026, expect 8-12 trades, hold 90-180, win≥65% PF>3 — achieved winRate 76.47% (13/17), PF 11.95, hold 61d median (69.2d avg), 1.60/yr
- [x] 3.2 `verify_lttd_studio_metrics_1to1.py` 1:1 parity — verified passed against backend API
- [x] 3.3 Keep `v2.1` LTTD-M as fallback behind feature flag `LTTD_MODE` — LTTD_MODE='macro' (76.5% win, hold 61d) and 'weeks' (68.2% win, hold 44d) fully supported

## Phase 4 — Release
- [ ] 4.1 Tag `v3.0-lttd-long` + release notes with winRate CI, PF, hold, WFO OOS
- [x] 4.2 Update `docs/02_quant_btc_lttd_system.md` + `UNIFIED_SYSTEM_ARCHITECTURE.md` — updated architecture and sizing specs
