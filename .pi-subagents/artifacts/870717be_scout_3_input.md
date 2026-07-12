# Task for scout

You are a delegated subagent running from a fork of the parent session. Treat the inherited conversation as reference-only context, not a live thread to continue. Do not continue or answer prior messages as if they are waiting for a reply. Your sole job is to execute the task below and return a focused result for that task using your tools.

Task:
Track D — Component Matrix & Metric Grid Audit

Compare the component matrix table in ValuationStudio.tsx against the prior MetricGrid.tsx and MetricCard.tsx.

FILES:
- Unified: /home/ubuntu/projects/quant.maftia.tech/web/src/components/studios/ValuationStudio.tsx (read fully, focus on INDICATOR_METADATA and table rendering)
- Prior: /home/ubuntu/projects/quant-btc-valuation-system/frontend/src/components/MetricGrid.tsx (read fully)
- Prior: /home/ubuntu/projects/quant-btc-valuation-system/frontend/src/components/MetricCard.tsx (read fully)
- Prior: /home/ubuntu/projects/quant-btc-valuation-system/frontend/src/types/metrics.ts (read fully)
- Unified types: /home/ubuntu/projects/quant.maftia.tech/web/src/api/types.ts (read fully)

CRITICAL INVESTIGATION:
1. **Score double-scaling check**: Unified does `toNum(s.normalized_score) * 2` to display score. Prior displayed `normalized_value` directly. Check types: ComponentSignal.normalized_score is number, prior MetricSummary.normalized_value was number. Prior displayed values at -2.0 to +2.0 range. The * 2 multiplication in unified suggests normalized_score may be [-1.0, +1.0] but this MUST be verified against actual data (check API response).
2. All 17 indicators exist in INDICATOR_METADATA with correct names
3. Category assignment (Fundamental/Technical/Sentiment)
4. Signal direction display terminology
5. Category filtering (buttons vs sections)
6. Mobile compact list layout
7. Metric detail navigation on row click

OUTPUT: Return structured JSON findings including resolved status of the critical score double-scaling question.

---
Update progress at: /home/ubuntu/projects/quant.maftia.tech/.pi-subagents/artifacts/progress/870717be/progress.md

---
**Output:**
Write your findings to exactly this path: /home/ubuntu/projects/quant.maftia.tech/.pi-subagents/artifacts/outputs/870717be/tracks/track-d-component-matrix.md
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