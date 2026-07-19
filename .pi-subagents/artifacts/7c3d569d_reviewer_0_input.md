# Task for reviewer

Review the OpenSpec change artifacts for "optimize-sdca-buy-sell-conditions". Focus on:

1. **Proposal Review** (`proposal.md`):
   - Is the problem statement clear and data-driven?
   - Are the non-goals properly scoped?
   - Is the impact analysis complete?

2. **Design Review** (`design.md`):
   - Are the technical decisions well-justified?
   - Are risks and trade-offs properly identified?
   - Is the migration plan feasible?

Read the files at:
- `/home/ubuntu/projects/quant.maftia.tech/openspec/changes/optimize-sdca-buy-sell-conditions/proposal.md`
- `/home/ubuntu/projects/quant.maftia.tech/openspec/changes/optimize-sdca-buy-sell-conditions/design.md`

Provide a structured review with:
- Strengths
- Weaknesses
- Suggestions for improvement
- Risk assessment

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