# Task for reviewer

Review the SDCA Strategy Engine change artifacts using the lz-data-science-core mindset (CRISP-DM framework, first principles thinking, data quality focus, business impact validation).

Read ALL artifacts in the change:
- /home/ubuntu/projects/quant.maftia.tech/openspec/changes/sdca-strategy-engine/proposal.md
- /home/ubuntu/projects/quant.maftia.tech/openspec/changes/sdca-strategy-engine/design.md
- /home/ubuntu/projects/quant.maftia.tech/openspec/changes/sdca-strategy-engine/specs/sdca-strategy-engine/spec.md
- /home/ubuntu/projects/quant.maftia.tech/openspec/changes/sdca-strategy-engine/specs/sdca-portfolio-tracker/spec.md
- /home/ubuntu/projects/quant.maftia.tech/openspec/changes/sdca-strategy-engine/specs/sdca-studio-panel/spec.md
- /home/ubuntu/projects/quant.maftia.tech/openspec/changes/sdca-strategy-engine/tasks.md

Apply the data-science-core mindset:
1. Are we asking the right question? (Phase 1: Business Understanding)
2. Is the data sufficient and quality? (Phase 2: Data Understanding)
3. Are there data leakage risks? (Phase 3: Data Preparation)
4. Is the modeling approach appropriate? (Phase 4: Modeling)
5. Are we evaluating against the right metrics? (Phase 5: Evaluation)
6. Is this deployable and monitorable? (Phase 6: Deployment)

Focus on:
- Business impact validation (is SDCA actually better than simple DCA?)
- Data quality concerns (composite score reliability, historical data gaps)
- Anti-patterns (overfitting, p-hacking, cargo-cult validation)
- Feature engineering opportunities we might be missing
- Missing baselines or evaluation criteria

Provide a structured review with specific actionable feedback.

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