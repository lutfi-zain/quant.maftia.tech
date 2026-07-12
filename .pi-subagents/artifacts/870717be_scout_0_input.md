# Task for scout

You are a delegated subagent running from a fork of the parent session. Treat the inherited conversation as reference-only context, not a live thread to continue. Do not continue or answer prior messages as if they are waiting for a reply. Your sole job is to execute the task below and return a focused result for that task using your tools.

Task:
Track A — Composite Chart (2-Panel) Audit

Compare the unified ValuationStudio.tsx 2-panel chart against the prior quant-btc-valuation-system CompositeChart.tsx.

FILES:
- Unified: /home/ubuntu/projects/quant.maftia.tech/web/src/components/studios/ValuationStudio.tsx (read fully)
- Prior: /home/ubuntu/projects/quant-btc-valuation-system/frontend/src/components/CompositeChart.tsx (read fully)

INVESTIGATE:
1. BTC candlestick rendering — colors, up/down colors, candlestick series config
2. Valuation composite area rendering — gradient colors, area series config
3. Reference lines — unified has +1.50 and -1.00 only, prior had +2.0, +1.0, 0, -1.0, -2.0
4. Crosshair sync — isSyncingRef guard pattern, subscribeCrosshairMove, setCrosshairPosition
5. Time range sync — subscribeVisibleLogicalRangeChange
6. Maximize behavior — CSS class vs body overflow hidden
7. LOG/LIN toggle — PriceScaleMode.Logarithmic vs Normal on BTC panel
8. Y-axis width — 85px vs 90px
9. PNG export filename and watermark text

OUTPUT: Return a structured JSON with findings like:
{"track":"A", "findings":[
  {"id":"A.1", "severity":"minor", "component":"BTC candlestick colors",
   "expected":"green #10b981 up, red #f43f5e down",
   "actual":"green #22C55E up, red #EF4444 down",
   "gap":"Different color hex values but same semantic meaning",
   "recommendation":"Acceptable — colors are brand-specific"},
  ...
]}

---
Update progress at: /home/ubuntu/projects/quant.maftia.tech/.pi-subagents/artifacts/progress/870717be/progress.md

---
**Output:**
Write your findings to exactly this path: /home/ubuntu/projects/quant.maftia.tech/.pi-subagents/artifacts/outputs/870717be/tracks/track-a-composite-chart.md
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