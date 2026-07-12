# Task for scout

You are a delegated subagent running from a fork of the parent session. Treat the inherited conversation as reference-only context, not a live thread to continue. Do not continue or answer prior messages as if they are waiting for a reply. Your sole job is to execute the task below and return a focused result for that task using your tools.

Task:
Track B — Metric Detail Chart (3-Panel) Audit

Compare the unified MetricDetailChart.tsx 3-panel detail chart against the prior AvivRatioChart.tsx and MetricDetail.tsx.

FILES:
- Unified: /home/ubuntu/projects/quant.maftia.tech/web/src/components/studios/MetricDetailChart.tsx (read fully)
- Prior: /home/ubuntu/projects/quant-btc-valuation-system/frontend/src/components/AvivRatioChart.tsx (read fully)
- Prior: /home/ubuntu/projects/quant-btc-valuation-system/frontend/src/components/MetricDetail.tsx (read fully)

INVESTIGATE:
1. 3-panel layout — panel order, series types (Candlestick/Line/Line vs Candlestick/Line/Area)
2. BTC data source — timeseriesData.btc_ohlc vs separate /api/metrics/btc_ohlc
3. Raw metric threshold lines — updateRawPriceLines helper vs static createPriceLine at mount
4. Oscillator reference lines — unified 3 lines (+2.0, 0, -2.0) vs prior 5 lines (+2.0, +1.0, 0, -1.0, -2.0)
5. Crosshair sync across 3 panels
6. mapToOscillator comparison — imported vs embedded, return semantics (null vs 0.0)
7. LOG/LIN toggle on BTC panel only
8. Per-panel maximize (new feature)
9. Y-axis width 85px vs prior 90px

OUTPUT: Return structured JSON findings array same format as Track A.

---
Update progress at: /home/ubuntu/projects/quant.maftia.tech/.pi-subagents/artifacts/progress/870717be/progress.md

---
**Output:**
Write your findings to exactly this path: /home/ubuntu/projects/quant.maftia.tech/.pi-subagents/artifacts/outputs/870717be/tracks/track-b-metric-detail.md
This path is authoritative for this run.
Ignore any other output filename or output path mentioned elsewhere, including output destinations in the base agent prompt, system prompt, or task instructions.

## Acceptance Contract
Acceptance level: checked
Completion is not accepted from prose alone. End with a structured acceptance report.

Criteria:
- criterion-1: Implement the requested change without widening scope

Required evidence: changed-files, tests-added, commands-run, residual-risks, no-staged-files

Finish with a fenced JSON block tagged `acceptance-report` in this shape:
Use empty arrays when no items apply; array fields contain strings unless object entries are shown.
```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "specific proof"
    }
  ],
  "changedFiles": [
    "src/file.ts"
  ],
  "testsAddedOrUpdated": [
    "test/file.test.ts"
  ],
  "commandsRun": [
    {
      "command": "command",
      "result": "passed",
      "summary": "short result"
    }
  ],
  "validationOutput": [
    "validation output or concise summary"
  ],
  "residualRisks": [
    "none"
  ],
  "noStagedFiles": true,
  "diffSummary": "short description of the diff",
  "reviewFindings": [
    "blocker: file.ts:12 - issue found, or no blockers"
  ],
  "manualNotes": "anything else the parent should know"
}
```