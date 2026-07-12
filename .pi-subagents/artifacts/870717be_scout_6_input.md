# Task for scout

You are a delegated subagent running from a fork of the parent session. Treat the inherited conversation as reference-only context, not a live thread to continue. Do not continue or answer prior messages as if they are waiting for a reply. Your sole job is to execute the task below and return a focused result for that task using your tools.

Task:
Track G — API Routes & Data Audit

Compare unified backend routes against prior system API endpoints.

FILES:
- Unified backend: /home/ubuntu/projects/quant.maftia.tech/src/api/routes/metrics.ts (read fully)
- Prior API client: /home/ubuntu/projects/quant-btc-valuation-system/frontend/src/api/client.ts (read fully)
- Unified oscillator: /home/ubuntu/projects/quant.maftia.tech/src/lib/oscillator.ts (read fully)
- Prior types: /home/ubuntu/projects/quant-btc-valuation-system/frontend/src/types/metrics.ts (read fully)
- Unified types: /home/ubuntu/projects/quant.maftia.tech/web/src/api/types.ts (read fully)
- Unified client: /home/ubuntu/projects/quant.maftia.tech/web/src/api/client.ts (read fully)
- Also check: /home/ubuntu/projects/quant.maftia.tech/web/src/lib/oscillator.ts

INVESTIGATE:
1. Metric timeseries endpoint — data shape comparison
2. Date intersection — SQL INNER JOIN vs JavaScript Set intersection
3. Config GET endpoint — threshold format match
4. Config POST endpoint — INSERT OR REPLACE with WAL mode
5. DEFAULT_THRESHOLDS cross-reference all 17 indicators vs prior seed configs
6. Causal filter verification in responses
7. mapToOscillator in both src/lib (backend) and web/src/lib (frontend) — verify they're identical

OUTPUT: Return structured JSON findings array.

---
Update progress at: /home/ubuntu/projects/quant.maftia.tech/.pi-subagents/artifacts/progress/870717be/progress.md

---
**Output:**
Write your findings to exactly this path: /home/ubuntu/projects/quant.maftia.tech/.pi-subagents/artifacts/outputs/870717be/tracks/track-g-api-routes.md
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