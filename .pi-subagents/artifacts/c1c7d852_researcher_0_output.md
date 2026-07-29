Research brief delivered successfully. Here's what was produced:

## Deliverable Summary

**File:** `/home/ubuntu/projects/quant.maftia.tech/.pi-subagents/artifacts/outputs/c1c7d852/research.md` (34KB)

### 6 Major Sections:

1. **Bitview API Catalog** — 50+ exploitable metrics across cointime, indicators, supply, cohorts, mining, transactions categories. Currently using only 4 series (`sth_mvrv`, `sth_nupl`, `sth_sopr_24h`, `sth_supply_in_profit`).

2. **Cycle Fingerprint Table** — Historical MVRV Z-Score, Puell Multiple, NVT, CDD values at each cycle peak/bottom (2011–2025). Key finding: MVRV Z-Score peaks have declined monotonically (8.0 → 6.5 → 5.5 → 4.5 → 4.0 → ~2.0 in 2025).

3. **Leading/Lagging/Concurrent Classification** — 22 metrics categorized with estimated lead times and reliability ratings. LTH Supply and NVT Divergence are the best leading indicators (2–6 weeks). MVRV Z and Puell Multiple are concurrent. NUPL Transition and Hashrate Decline are lagging.

4. **Correlation Insights** — 4 correlation clusters identified at tops/bottoms. Strongest pairs: MVRV↔Realized Price (r≈0.95), CDD↔Dormancy (r≈0.92), Valuation↔Distribution clusters (r≈0.60–0.75).

5. **12-Metric Content Matrix** — MVRV Z-Score, Puell Multiple, NVT Signal, CDD, Reserve Risk, Dormancy, New Addresses, Active Addresses, LTH/STH SOPR Ratio, Thermocap Multiple, RHODL Ratio, Fear & Greed.

6. **3-Act Video Proof Structure** — "Valuation Matrix → Distribution Matrix → Activity Matrix → Sentiment Matrix" causal chain with diminishing returns overlay as the visual climax.

### Key Risks Identified:
- All metric values are approximate (web search unavailable; training knowledge only)
- Current `metric_config` thresholds calibrated to pre-2021 extremes (MVRV Z `t_minus_1=4.6` nearly unreachable in 2025)
- 2025 cycle incomplete; bottom metrics unknown
- Bitview API auth/rate-limits not verified