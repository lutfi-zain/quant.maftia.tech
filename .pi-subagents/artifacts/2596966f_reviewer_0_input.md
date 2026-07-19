# Task for reviewer

[Read from: /home/ubuntu/projects/quant.maftia.tech/plan.md, /home/ubuntu/projects/quant.maftia.tech/progress.md]

Review the spec files in /home/ubuntu/projects/quant.maftia.tech/openspec/changes/fix-price-source-and-audit-backend/specs/ for completeness and correctness. Focus on:
1. audit-data-integrity/spec.md - Is the price source enforcement requirement clear? Are scenarios testable?
2. master-ohlcv-canonical-storage/spec.md delta - Does the MODIFIED requirement properly constrain btc_price?

Read each spec file and report:
- Missing scenarios or edge cases
- Ambiguous requirements that could be misinterpreted
- Inconsistencies with the project's Ubiquitous Language (MasterOHLCV, UnifiedDailyAnalytics, etc.)
- Whether the requirements are testable/verifiable

Do not modify files. Return findings with file/line references.

---
**Output:**
Write your findings to exactly this path: /home/ubuntu/projects/quant.maftia.tech/.pi-subagents/artifacts/outputs/2596966f/review-data-integrity.md
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