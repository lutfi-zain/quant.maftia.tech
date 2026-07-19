# Task for reviewer

Review the OpenSpec delta specifications for "optimize-sdca-buy-sell-conditions". Focus on:

1. **Specs Completeness**:
   - Are all modified requirements properly documented?
   - Do scenarios follow WHEN/THEN format correctly?
   - Are the new requirements (Adaptive Position Sizing) well-defined?

2. **Specs Consistency**:
   - Do the specs align with the proposal and design?
   - Are the threshold values consistent across all specs?
   - Is the sign convention preserved correctly?

**CRITICAL CONTEXT**: A reviewer has already found that the sign convention in `sdcaEngine.ts` is INVERTED. The correct convention is:
- Positive composite (+1.5 to +2.0) = Overvalued → SELL zone
- Negative composite (-1.0 to -2.0) = Undervalued → BUY zone

This is confirmed by:
- Valuation System Doc §4.1
- API Daily Route (`bubble_warning: composite >= 1.5`)
- Test file expectations (`sdcaMultiplier(1.6)` → expects `-0.5` sell)
- `studioBacktest.ts` implementation

The current `sdcaEngine.ts` has this BACKWARDS. Review the specs to see if they correctly document the sign convention or if they perpetuate the inversion.

Read the spec files at:
- `/home/ubuntu/projects/quant.maftia.tech/openspec/changes/optimize-sdca-buy-sell-conditions/specs/sdca-strategy-engine/spec.md`
- `/home/ubuntu/projects/quant.maftia.tech/openspec/changes/optimize-sdca-buy-sell-conditions/specs/sdca-backend-computation/spec.md`
- `/home/ubuntu/projects/quant.maftia.tech/openspec/changes/optimize-sdca-buy-sell-conditions/specs/sdca-studio-panel/spec.md`

Also read the existing test file to understand the correct convention:
- `/home/ubuntu/projects/quant.maftia.tech/web/src/lib/__tests__/sdcaEngine.test.ts`

Provide a structured review with:
- Sign convention correctness assessment
- Completeness assessment
- Consistency issues
- Missing scenarios
- Suggestions for improvement

## Acceptance Contract
Acceptance level: attested
Completion is not accepted from prose alone. End with a structured acceptance report.

Criteria:
- criterion-1: Return concrete findings with file paths and severity when applicable

Required evidence: review-findings, residual-risks

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