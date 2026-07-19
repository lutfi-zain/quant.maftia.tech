# Task for reviewer

[Read from: /home/ubuntu/projects/quant.maftia.tech/plan.md, /home/ubuntu/projects/quant.maftia.tech/progress.md]

Review the spec files in /home/ubuntu/projects/quant.maftia.tech/openspec/changes/fix-price-source-and-audit-backend/specs/ for frontend integration and migration safety. Focus on:
1. frontend-position-truth/spec.md - Is the position sourcing change clear? Are fallback behaviors specified?
2. proposal.md - Is the scope well-defined? Are non-goals properly excluded?
3. design.md - Is the migration plan safe? Are rollback strategies adequate?

Read each spec file and report:
- Migration risks not addressed
- Missing rollback scenarios
- Frontend behavior changes that could break UX
- Whether the verification script overhaul is properly specified

Do not modify files. Return findings with file/line references.

---
**Output:**
Write your findings to exactly this path: /home/ubuntu/projects/quant.maftia.tech/.pi-subagents/artifacts/outputs/2596966f/review-frontend-migration.md
This path is authoritative for this run.
Ignore any other output filename or output path mentioned elsewhere, including output destinations in the base agent prompt, system prompt, or task instructions.

## Acceptance Contract
Acceptance level: reviewed
Completion is not accepted from prose alone. End with a structured acceptance report.

Criteria:
- criterion-1: Implement the requested change without widening scope
- criterion-2: Return evidence sufficient for an independent acceptance review

Required evidence: changed-files, tests-added, commands-run, validation-output, residual-risks, no-staged-files

Review gate: required by reviewer.

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