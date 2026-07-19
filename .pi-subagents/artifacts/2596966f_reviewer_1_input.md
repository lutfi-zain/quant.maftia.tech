# Task for reviewer

[Read from: /home/ubuntu/projects/quant.maftia.tech/plan.md, /home/ubuntu/projects/quant.maftia.tech/progress.md]

Review the spec files in /home/ubuntu/projects/quant.maftia.tech/openspec/changes/fix-price-source-and-audit-backend/specs/ for API design and backend computation correctness. Focus on:
1. sdca-backend-computation/spec.md - Are the endpoint contracts clear? Is the shared module design sound?
2. local-calculation-engines/spec.md delta - Does the MODIFIED requirement properly add shared SDCA module?

Read each spec file and report:
- API contract gaps (missing request/response fields, error cases)
- Shared module design issues (import paths, dependency management)
- Whether t-1 causal enforcement is properly specified
- Audit trail completeness for the auditability goal

Do not modify files. Return findings with file/line references.

---
**Output:**
Write your findings to exactly this path: /home/ubuntu/projects/quant.maftia.tech/.pi-subagents/artifacts/outputs/2596966f/review-backend-computation.md
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