## 1. Diagnostic — Verify Equity Curve Data Format

- [x] 1.1 Run SQL probe: `SELECT MIN(ichi_cum_strat), MAX(ichi_cum_strat), MIN(ichi_cum_market), MAX(ichi_cum_market) FROM unified_daily_analytics WHERE ichi_cum_strat IS NOT NULL` and confirm all max values are `< 100.0` (decimal, not multiplier form)
- [x] 1.2 Spot-check a recent date: `SELECT date, ichi_cum_strat, ichi_cum_market FROM unified_daily_analytics ORDER BY date DESC LIMIT 5` and cross-reference against expected total-return percentage from Python engine
- [x] 1.3 Confirm pipeline `run_report_pipeline.py:L408` stores `float(r["Cum_Strat"])` — which from `backtest.py:L27` is `(1+r).cumprod()-1` (decimal baseline, not `+1` multiplier)
- [x] 1.4 Run `python3 verify_ichimoku_studio_metrics_1to1.py` as baseline — record current pass/fail counts

## 2. Fix — IMO Banner Label (STATIONARY BOUNDED TANH → IMO DENOISED OSCILLATOR)

- [x] 2.1 In `web/src/components/studios/IchimokuTerminal.tsx` line 987, change the `studio-metric-label` span text from `STATIONARY BOUNDED TANH` to `IMO DENOISED OSCILLATOR`
- [x] 2.2 Add a small sub-formula annotation below the IMO value (or as a `title` tooltip attribute) describing the full transformation chain: `tanh → SuperSmoother[l=7] → [-1, +1]`
- [x] 2.3 Verify the `toNum()` fallback chain at lines 206–209 still correctly resolves `latestPoint?.ichimoku_imo` as a flat number (after `client.ts` flattening at line 114), not an object — add a `console.assert(typeof latestImo === 'number')` guard in dev mode if needed

## 3. Fix — Equity Curve Chart Rendering (Conditional on Diagnostic Results)

- [x] 3.1 **[SKIP]** `ichi_cum_strat` is indeed decimal, but chart was modified to plot rebased `backtestResult` to align chart and metrics card
- [x] 3.2 **[SKIP]** Pipeline stores correct values; no database re-population required
- [x] 3.3 Verify `null` filtering is in place on both `refStratSeries.setData()` (line 736–742) and `refMarketSeries.setData()` (line 744–751) — confirm `.filter((d) => d.value != null)` exists on both
- [x] 3.4 Add `priceFormatter` consistency check — confirm the equity chart's `localization.priceFormatter` (line 558–563) outputs `%` suffix for both reference and interactive series Y-axis labels

## 4. Enhancement — Data Source Transparency Badge

- [x] 4.1 Add a data-source badge in the equity pane chart header (`chart-subplot-header` for the `eq` pane) displaying `PY ENGINE` to indicate that the green/grey reference curves come from pre-computed Python backtest columns (`ichi_cum_strat`)
- [x] 4.2 Confirm that the `useStudioBacktest` reference mode metric display shows `source: "reference"` in the metrics stats bar (already tracked via `usedReference` flag in `studioBacktest.ts:L415`) — verify this is surfaced in the UI metrics grid
- [x] 4.3 Check that `interactiveStrat` and `interactiveMarket` series (what-if overlay) are clearly labelled `What-If` in chart legend titles (already set at lines 586, 594 in `IchimokuTerminal.tsx` — confirm no regression)

## 5. Verification — Parity Harness

- [x] 5.1 Re-run `python3 verify_ichimoku_studio_metrics_1to1.py` and confirm `100/100 (100.0%)` all assertions pass
- [x] 5.2 Rebuild frontend: `cd /home/ubuntu/projects/quant.maftia.tech/web && bun run build` and confirm zero TypeScript errors
- [x] 5.3 Visually verify the equity pane in the browser: check that Y-axis values show e.g. `+69.30%` not `+6930.00%` or `+0.69%`
- [x] 5.4 Visually verify the banner metric header now reads `IMO DENOISED OSCILLATOR` with correct `+/-` value and color

## 6. Commit

- [x] 6.1 Stage all changed files: `web/src/components/studios/IchimokuTerminal.tsx` (and optionally `run_report_pipeline.py` if pipeline fix was needed)
- [x] 6.2 Commit with Conventional Commits format: `fix(ichimoku): correct IMO banner label and verify equity curve decimal baseline`
- [x] 6.3 Push to feature branch (do NOT force-push to `main`): `git push origin fix/ichimoku-equity-tanh-audit`
