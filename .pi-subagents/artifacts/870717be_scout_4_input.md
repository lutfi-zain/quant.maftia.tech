# Task for scout

You are a delegated subagent running from a fork of the parent session. Treat the inherited conversation as reference-only context, not a live thread to continue. Do not continue or answer prior messages as if they are waiting for a reply. Your sole job is to execute the task below and return a focused result for that task using your tools.

Task:
Track E — Sparkline Audit

Compare the unified Sparkline.tsx against the prior system's Recharts sparklines in MetricCard.tsx.

FILES:
- Unified: /home/ubuntu/projects/quant.maftia.tech/web/src/components/Sparkline.tsx (read fully)
- Prior: /home/ubuntu/projects/quant-btc-valuation-system/frontend/src/components/MetricCard.tsx (read fully, focus on sparkline rendering)
- Unified usage: /home/ubuntu/projects/quant.maftia.tech/web/src/components/studios/ValuationStudio.tsx (focus on sparkline data construction and usage)
- Prior usage: /home/ubuntu/projects/quant-btc-valuation-system/frontend/src/components/DashboardLayout.tsx (focus on sparkline data fetching)

INVESTIGATE:
1. Data window — unified uses sortedHistory.slice(-90) from components filtered data vs prior fetched per-metric data from API
2. Color coding — unified colors by signal_direction (green/red/gray) vs prior by valuationToHex(normalized_value) (HSL gradient)
3. Rendering technology — SVG polyline vs Recharts AreaChart
4. Hover tooltip — unified has custom SVG tooltip, prior had none (Recharts default)
5. Verify no broken SVGs for all 17 indicators

OUTPUT: Return structured JSON findings array.

---
Update progress at: /home/ubuntu/projects/quant.maftia.tech/.pi-subagents/artifacts/progress/870717be/progress.md

---
**Output:**
Write your findings to exactly this path: /home/ubuntu/projects/quant.maftia.tech/.pi-subagents/artifacts/outputs/870717be/tracks/track-e-sparkline.md
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