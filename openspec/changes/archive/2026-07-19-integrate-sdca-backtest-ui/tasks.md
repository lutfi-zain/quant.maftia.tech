## 1. ValuationStudio SDCA Integration

- [x] 1.1 Map `dailyData` to `SdcaDailyRecord[]` instead of `StudioDailyRecord[]` to prepare for `useSdcaBacktest`.
- [x] 1.2 Replace the `useStudioBacktest` hook invocation with `useSdcaBacktest`, removing the hardcoded `pos = score >= 1.5 ? 0 : 1` logic.
- [x] 1.3 Update the Metrics Panel UI to safely consume the `SdcaBacktestMetrics` structure, including SDCA-specific additions if needed, ensuring no type mismatches crash the UI.
- [x] 1.4 Verify that the Chart Markers (arrows) are correctly sourced from the new `useSdcaBacktest` result.
- [x] 1.5 Verify that the "CAUSAL EXECUTION LOG" table correctly iterates over `backtestResult.trades` from the SDCA backtest, rendering dynamic trade sizing or actions accurately.
- [x] 1.6 Confirm that the right price/oscillator Y-axis width lock remains at `85px` and Vertical Crosshair Synchronization remains functional after changing the backtest source.
