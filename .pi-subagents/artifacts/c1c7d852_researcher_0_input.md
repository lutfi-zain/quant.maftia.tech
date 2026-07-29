# Task for researcher

You are an **External Researcher** investigating Bitview.space onchain metrics API and BTC cycle analysis methodologies for a data-driven video content project.

## Context
We are building a data-driven video about Bitcoin cycle analysis using onchain metrics. Our system uses 17 indicators (MVRV Z-Score, AVIV Ratio, CVDD Ratio, AHR999, Fear & Greed, Pi Cycle Top, etc.) normalized to [-2, +2]. We need to understand:

1. What additional onchain metrics are available via the Bitview.space API that we don't currently use
2. How BTC cycle peaks and bottoms manifest across different onchain metrics
3. Which metrics have the strongest predictive/correlative power at cycle extremes

## Your Mission

### Part 1: Bitview.space API Metric Catalog
The Bitview.space API has these top-level categories (from `https://bitview.space/api/series`):
- **blocks**: blockhash, coinbase_tag, difficulty, time, size, weight, segwit_txs, segwit_size, segwit_weight, count
- **transactions**: raw, count, size, fees, versions, volume
- **inputs**: raw, spent, count, per_sec, by_type
- **outputs**: raw, spent, count, per_sec, unspent, by_type, value
- **addrs**: raw, indexes, data, funded, empty, activity, total, new, reused, respent
- **mining**: rewards, hashrate
- **cointime**: activity, supply, value, cap, prices, adjusted, reserve_risk
  - `cointime.value.stored`: block, cumulative, sum, average
  - `cointime.cap`: thermo, investor, vaulted, active, cointime, aviv
  - `cointime.prices`: vaulted, active, true_market_mean, cointime
  - `cointime.adjusted`: inflation_rate, tx_velocity_native, tx_velocity_fiat
- **indicators**: puell_multiple, nvt, gini, rhodl_ratio, thermo_cap_multiple, coindays_destroyed_supply_adj, coinyears_destroyed_supply_adj, dormancy, stock_to_flow, seller_exhaustion, rarity_meter
- **market**: ath, lookback, returns, volatility, range, moving_average, technical
- **supply**: state, circulating, burned, inflation_rate, velocity, market_cap, market_minus_realized_cap_growth_rate, hodled_or_lost
- **cohorts**: utxo, addr
- **price**: split, ohlc, spot

Search the web for:
1. "bitview.space bitcoin onchain metrics API" — documentation, usage examples
2. "Bitcoin onchain cycle top indicators MVRV NVT SOPR CDD" — which metrics predict tops
3. "Bitcoin diminishing returns each cycle onchain" — why peaks get lower in normalized metrics
4. "onchain metrics correlation matrix Bitcoin" — empirical correlation studies
5. "Bitcoin 2025 cycle analysis onchain" — current cycle position analysis

### Part 2: Cycle Peak/Bottom Metric Signatures
For each Bitcoin cycle, research what onchain metric values characterized the TOP and BOTTOM:

**2013 Cycle** (Peak: ~$1,150 Nov 2013, Bottom: ~$200 Jan 2015):
- MVRV Z-Score at peak/bottom
- Puell Multiple at peak/bottom
- NVT at peak/bottom
- CDD activity at peak

**2017 Cycle** (Peak: ~$19,800 Dec 2017, Bottom: ~$3,200 Dec 2018):
- Same metrics

**2021 Cycle** (Peak: ~$69K Nov 2021, Bottom: ~$15.8K Nov 2022):
- Same metrics

**2024-2025 Cycle** (Peak: ~$124K Oct 2025, Current: pulling back):
- Same metrics where available

### Part 3: Content Matrix for Video
The video needs to prove that "at every cycle, certain MATRIX components determine other correlated matrices." Research:
1. Which onchain metrics LEAD cycle tops (signal 2-4 weeks before price peak)?
2. Which LAG cycle tops (confirm after price drops)?
3. Which are CONCURRENT with tops?
4. What is the "cycle fingerprint" — the specific combination of metric values that characterizes each extreme?
5. How does the diminishing returns thesis apply to onchain metrics (each cycle's MVRV peak is lower)?

## Output Format
Return:
1. **Bitview API Catalog**: Complete list of usable metrics with descriptions
2. **Cycle Fingerprint Table**: Metric values at each cycle peak/bottom
3. **Leading/Lagging/Concurrent Classification**: Which metrics predict vs confirm
4. **Correlation Insights**: Strongest metric-to-metric relationships at extremes
5. **Content Matrix Recommendation**: The 10-12 best metrics for the video narrative
6. **Source Links**: URLs for every claim

Confidence: MEDIUM (web research, some 2025 data may be speculative)


---
**Output:**
Write your findings to exactly this path: /home/ubuntu/projects/quant.maftia.tech/.pi-subagents/artifacts/outputs/c1c7d852/research.md
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