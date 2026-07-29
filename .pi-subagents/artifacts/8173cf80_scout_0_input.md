# Task for scout

You are a **Local Codebase Scout** investigating the Valuation Composite score calculation architecture.

## Context
This is a quantitative Bitcoin valuation platform at `/home/ubuntu/projects/quant.maftia.tech`. The Valuation Composite Score is calculated from 17 onchain/technical/sentiment indicators, each normalized to [-2, +2] via piecewise linear interpolation, then averaged.

## Your Mission
Investigate the FULL calculation pipeline of the Valuation Composite Score. Specifically:

1. **Read `engines/valuation/quant/components/registry.py`** to understand which components are registered and how they map to the composite
2. **Read `engines/valuation/quant/components/base.py`** to understand the BaseComponent class and its `normalize()` method
3. **Read `engines/valuation/quant/audit/composite.py`** to understand how the composite is calculated
4. **Read `engines/valuation/quant/run_all.py`** to understand the orchestration
5. **Read `engines/valuation/quant/components/normalization.py`** fully (all 193 lines) to understand piecewise interpolation
6. **Check `data/maftia_quant.db`** metric_config table - query ALL rows to see the exact threshold values for each indicator
7. **Read `data/metric_thresholds.json`** if it exists - to understand threshold configurations
8. **Query `data/maftia_quant.db`** for `indicator_scores` table - check what data is there and schema
9. **Read `engines/valuation/quant/components/mvrv_z.py`** as a representative component to understand the full fetch→normalize flow
10. **Check `scripts/audit_valuation.py`** for how audits are run

## Key Question to Answer
WHY does the composite score cap at approximately -0.27 in Oct/Nov 2025 when BTC price was at $124K ATH? Is it because:
- The thresholds are calibrated per-cycle (expanding window)?
- Some indicators are returning NaN/partial values?
- The normalization caps at -2.0 per indicator but the average of 17 indicators rarely reaches extreme values?
- The indicators use historical standard deviation windows that haven't caught up to 2025 prices?

## Output Format
Return a structured report with:
- **Component Registry**: Full list of active components, their raw metric names, and whether they're inverted
- **Normalization Logic**: Exact algorithm description with threshold source
- **Composite Calculation**: Formula, weighting, handling of NaN/missing values
- **Threshold Configuration**: All metric_config values from the database
- **Likely Root Cause**: Your best hypothesis for why composite doesn't reach -2.0 in 2025
- **File Paths & Line Numbers**: For every finding

Confidence: HIGH (direct code reading)


---
**Output:**
Write your findings to exactly this path: /home/ubuntu/projects/quant.maftia.tech/.pi-subagents/artifacts/outputs/8173cf80/context.md
This path is authoritative for this run.
Ignore any other output filename or output path mentioned elsewhere, including output destinations in the base agent prompt, system prompt, or task instructions.

## Acceptance Contract
Acceptance level: attested
Completion is not accepted from prose alone. End with a structured acceptance report.

Criteria:
- criterion-1: Return concrete findings with file paths and severity when applicable

Required evidence: review-findings, residual-risks

Finish with a fenced JSON block tagged `acceptance-report` in this shape:
Use empty arrays when no items apply; array fields contain strings unless object entries are shown.
`criteriaSatisfied[].status` must be exactly one of: satisfied, not-satisfied, not-applicable.
`commandsRun[].result` must be exactly one of: passed, failed, not-run.
`manualNotes` and `notes` are optional strings; an empty string means no note and does not satisfy `manual-notes` evidence.
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