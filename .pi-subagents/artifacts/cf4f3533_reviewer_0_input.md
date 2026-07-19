# Task for reviewer

Review the implementation tasks for "optimize-sdca-buy-sell-conditions". Focus on:

1. **Task Completeness**:
   - Are all spec requirements covered by tasks?
   - Are there any missing implementation steps?
   - Are acceptance criteria measurable?

2. **Task Ordering**:
   - Are dependencies properly sequenced?
   - Can tasks be parallelized where possible?
   - Are there any blocking issues?

3. **Task Feasibility**:
   - Are tasks small enough to complete in one session?
   - Are verification steps included?
   - Is the pipeline verification comprehensive?

**CRITICAL CONTEXT**: Two reviewers have found that the sign convention in `sdcaEngine.ts` is INVERTED. The correct convention is:
- Positive composite (+1.5 to +2.0) = Overvalued → SELL zone
- Negative composite (-1.0 to -2.0) = Undervalued → BUY zone

This is confirmed by:
- Valuation System Doc §4.1
- API Daily Route (`bubble_warning: composite >= 1.5`)
- Test file expectations (`sdcaMultiplier(1.6)` → expects `-0.5` sell)
- `studioBacktest.ts` implementation

The current `sdcaEngine.ts` has this BACKWARDS. The tasks.md does NOT address fixing this critical bug. Review the tasks to identify:
1. Missing tasks for fixing the sign convention
2. Missing tasks for aligning `studioBacktest.ts`
3. Missing tasks for re-running audits after the fix
4. Any other gaps in the implementation plan

Read the task file at:
- `/home/ubuntu/projects/quant.maftia.tech/openspec/changes/optimize-sdca-buy-sell-conditions/tasks.md`

Also read the existing implementation files to understand the codebase:
- `/home/ubuntu/projects/quant.maftia.tech/src/lib/sdcaEngine.ts`
- `/home/ubuntu/projects/quant.maftia.tech/web/src/lib/studioBacktest.ts`
- `/home/ubuntu/projects/quant.maftia.tech/web/src/lib/__tests__/sdcaEngine.test.ts`

Provide a structured review with:
- Coverage assessment (specs → tasks)
- Missing tasks (especially sign convention fix)
- Task ordering issues
- Feasibility concerns
- Suggestions for improvement

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