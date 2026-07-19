# Task for reviewer

Review the SDCA Strategy Engine change artifacts using the lz-quant-researcher mindset (radical skepticism, walk-forward validation, factor decomposition, anti-pattern detection).

Read ALL artifacts in the change:
- /home/ubuntu/projects/quant.maftia.tech/openspec/changes/sdca-strategy-engine/proposal.md
- /home/ubuntu/projects/quant.maftia.tech/openspec/changes/sdca-strategy-engine/design.md
- /home/ubuntu/projects/quant.maftia.tech/openspec/changes/sdca-strategy-engine/specs/sdca-strategy-engine/spec.md
- /home/ubuntu/projects/quant.maftia.tech/openspec/changes/sdca-strategy-engine/specs/sdca-portfolio-tracker/spec.md
- /home/ubuntu/projects/quant.maftia.tech/openspec/changes/sdca-strategy-engine/specs/sdca-studio-panel/spec.md
- /home/ubuntu/projects/quant.maftia.tech/openspec/changes/sdca-strategy-engine/tasks.md

Also read the valuation system architecture to understand the existing sign conventions:
- /home/ubuntu/projects/quant.maftia.tech/UNIFIED_SYSTEM_ARCHITECTURE.md
- /home/ubuntu/projects/quant.maftia.tech/engines/valuation/quant/components/registry.py

Apply the quant-researcher mindset with radical skepticism:

1. **The Haircut Rule**: If backtest shows Sharpe 2.0, expect 1.0 live. Are we accounting for this?
2. **Overfitting Detection**: Are the piecewise thresholds overfitted to historical data?
3. **Factor Decomposition**: Is the "alpha" from SDCA actually just disguised beta exposure?
4. **Walk-Forward Validation**: The specs don't require out-of-sample testing. Is this a critical gap?
5. **Look-Ahead Bias**: Are we certain the t-1 causal filter is properly enforced?
6. **Regime Blindness**: The design mentions this as a risk but doesn't address it in specs
7. **Cost Blindness**: Transaction costs, slippage, market impact — are they modeled?
8. **Capacity Limits**: Does this strategy work at scale?
9. **SIGN CONVENTION**: Verify the existing valuation system's sign convention. The data science reviewer found that the SDCA proposal may have inverted the signs — treating high composite as "buy" when the existing system treats high composite as "overvalued/bubble". Confirm this and provide recommendations.

Be brutally honest. Identify the 3 biggest risks that could cause this strategy to fail in production.

Provide a structured review with specific, actionable recommendations.

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