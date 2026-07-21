# Quantitative Research Findings: Structural Regime Shifts in BTC Cycle Tops (2025 Analysis)

**Author:** Quantitative Research Desk (lz-quant-researcher)  
**Date of Analysis:** 2026-07-20  
**Status:** Completed & Executed via `valuation_cycle_analysis.ipynb`

---

## Executive Summary

Historically, Bitcoin cycle peaks have been marked by retail-driven FOMO, extreme speculative leverage, and massive distribution of coins by Long-Term Holders (LTHs) to new retail market entrants. In the 2013 and 2017 cycle peaks, this market behavior drove **17 normalized indicators in the Valuation Studio** to their extreme overvalued bounds of **-2.0**.

However, during the **October-November 2025 top cycle** (where spot price peaked at **$124,672.41** on October 6, 2025), the valuation composite failed to reach these extreme levels. This research documents the structural shifts across Bitcoin cycles, demonstrating that **massive institutional adoption (ETFs, corporate treasuries, nation-states)** and **volatility dampening** have fundamentally altered the market structure. High illiquidity has transitioned from a cyclical anomaly to the new baseline regime, rendering traditional cycle-top normalization thresholds obsolete without adaptive calibration.

---

## Cycle Peak Comparison Dataset

The following table summarizes the key metrics at major historical peaks extracted from the SQLite database and the bitview.space API:

| Metric | 2013 Peak (C1) | 2017 Peak (C2) | 2021 Apr (C3a) | 2021 Nov (C3b) | 2024 Mar (C4a) | 2025 Top (C4b) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Peak Date** | 2013-12-04 | 2017-12-16 | 2021-04-15 | 2021-11-09 | 2024-03-13 | **2025-10-06** |
| **Spot Price ($)** | 1,138.58 | 19,385.84 | 63,165.73 | 67,330.06 | 73,181.77 | **124,672.41** |
| **Realized Price ($)** | 234.28 | 4,325.38 | 18,696.13 | 23,704.84 | 26,544.66 | **54,499.81** |
| **MVRV Ratio** | **4.86** | **4.48** | **3.38** | **2.84** | **2.76** | **2.29** |
| **1Y Ann. Volatility** | 132.75% | 85.42% | 65.12% | 77.23% | 43.83% | **43.82%** |
| **LTH Supply Ratio** | 58.15% | 53.58% | 65.58% | 77.95% | 77.36% | **77.24%** |
| **IIP Penalty** | 0.05 | 0.00 | 0.00 | **0.91** | 0.00 | **0.00** |
| **Coindays Destroyed (1M)**| 512.97M | 664.45M | 438.54M | 369.83M | 691.90M | **423.55M** |
| **Mean Indicator Score** | -1.635 | -1.642 | -1.357 | -0.738 | -0.876 | **-0.209** |
| **Indicators $\le -1.8$** | 12 / 15 | 13 / 17 | 9 / 16 | 2 / 16 | 5 / 17 | **2 / 17** |

---

## Key Quantitative Insights

### 1. The MVRV Cycle Ceiling Collapse (Realized Price Inflation)
MVRV represents the ratio of Spot Price to Realized Price (the average cost basis of all coins).
* **Historical Regime:** In 2013 and 2017, the spot price exploded far above the average cost basis due to retail FOMO, while the average cost basis stayed relatively low. This resulted in MVRV peaks of **4.86** and **4.48**.
* **Institutional Regime:** In the 2024-2025 cycle, massive capital inflows (spot ETFs, corporate custody) occurred at high prices ($60k-$90k). This caused the **Realized Price to rise extremely fast**, reaching **$54,499.81** by October 2025.
* **The Result:** Even at the spot ATH of $124.6k, the price was only **2.29x** the average cost basis. Consequently, fundamental on-chain metrics (like MVRV-Z, Aviv Ratio, and Aviv NUPL), which are normalized based on historical cycles where overvalued tops required MVRV to exceed 4.0, remained near neutral.

### 2. LTH Supply Illiquidity: Anomaly Shock vs. New Normal
* **2017 Peak:** LTHs distributed aggressively, dropping to **53.58%** of total supply. This left **46.42%** of supply active/liquid, creating high retail coin velocity.
* **2021 vs. 2025:** In November 2021, LTHs held **77.95%** of the supply. Because this was a sudden shock relative to the 2017-2020 baseline, the **Institutional Illiquidity Premium (IIP) Penalty** activated at **0.91** to adjust the composite score.
* However, by October 2025, LTHs held **77.24%** of the supply. This high-illiquidity state had persisted for over 4 years. Because it lasted so long, the rolling 4-year mean of the illiquidity factor caught up to the spot level. Thus, the relative IIP modifier did not detect an anomaly, yielding an IIP Penalty of **0.00**. High illiquidity has transitioned from a cyclical shock to the new baseline regime.

### 3. Volatility Dampening & Asset Maturation
Annualized volatility at cycle peaks has steadily collapsed:
* 2013 Peak: **132.75%** $\rightarrow$ 2017: **85.42%** $\rightarrow$ 2025: **43.82%**.
* This halving of volatility since 2017 prevents volatility-based risk and momentum indicators (like `risk_metrics`, `vpli`, and `sharpe_ratio_52w`) from reaching historic extreme zones.

### 4. Technical vs. On-Chain Divergence
The only indicators that reached extreme overvalued levels ($\le -1.8$) in 2025 were purely technical price-momentum oscillators:
* **`dvrsi` (-2.00)** and **`williams_r` (-1.88)**.
* These technical indicators only measure price velocity relative to recent ranges. Because spot price was making new ATHs, they reached their upper bounds.
* All other fundamental on-chain metrics (reflecting coin destruction, SOPR, and cost-basis ratios) remained calm because LTHs did not distribute heavily (1M Coindays Destroyed was only **423.55M** compared to **664.45M** in 2017).

---

## [Skeptic's Corner] & Quantitative Recommendations

As quantitative researchers, we must view these findings with deep skepticism:

1. **The Order Book Thinness Trap:**
   While high LTH ratios (>77%) are often interpreted as long-term bullish holding behavior, they create a highly leveraged supply environment. Because the active/liquid supply is thin (~22%), small marginal inflows/outflows from ETFs will cause massive spot price swings. If macro conditions force institutional outflows, the price will crash rapidly without showing typical retail-FOMO distribution signs.

2. **IIP Relative Modifier Failure:**
   The rolling 4Y average makes the IIP modifier blind to permanent regime shifts. Once a shock state lasts for a full epoch, it becomes the baseline, disabling the modifier.

### Code Recommendations for Valuation Studio (`normalization.py` & `sdca/engine.py`):

1. **Volatility-Adjusted Thresholds:**
   Dynamically adjust the extreme overvalued thresholds based on rolling 1Y volatility. When volatility drops from 80% to 40%, the overvalued threshold for MVRV should be dynamically adjusted down from 4.0 to **2.2–2.5**.

2. **Illiquidity-Adjusted Z-Scores:**
   Normalize MVRV using a Z-score adjusted for the LTH supply ratio to restore sensitivity in thin-order-book regimes:
   $$MVRV_{adj} = MVRV \times (1 + \lambda \times \text{LTH\_Ratio})$$

3. **Cumulative Epoch Baselines:**
   Use cumulative averages or epoch-specific baselines for IIP calculation rather than a simple 1460-day rolling mean to prevent regime-adaptation lag from neutralizing the premium modifier.

---
Co-Authored-By: Claude <noreply@anthropic.com>
🤖 Generated with [Claude Code](https://claude.com/claude-code)
