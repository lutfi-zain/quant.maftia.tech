## Context

The PCA compression layer added in `fix-valuation-composite-integrity` introduced rolling-window non-stationarity, causing 60x/year signal turnover vs 10x/year for simple average. Empirical backtesting over 5 years shows simple average of 14 pruned indicators outperforms PCA by 8.1% absolute return in SDCA strategy simulation. The frontend still displays 17 indicator cards, but two (`williams_r`, `fear_greed_cmc`) provide redundant/low-quality signals. A phase timeline visualization would improve user insight into SDCA regime transitions.

## Goals / Non-Goals

**Goals:**

- Remove PCA compression; revert `valuation_composite` to simple average of 14 indicators.
- Remove `pca_compression.py` and its import from `run_report_pipeline.py`.
- Remove `williams_r` and `fear_greed_cmc` indicator cards from Valuation Studio UI.
- Add SDCA phase timeline (colored bar strip) below the main chart.

**Non-Goals:**

- Modifying other studios (LTTD Lab, MTTD Console, Ichimoku Terminal).
- Changing the API Gateway or database schema.
- Re-introducing `quant-technical-indicator-bank`.

## Decisions

- **Simple Average of 14**: After pruning `aviv_nupl` (redundant with `aviv_ratio`), `williams_r` (single-sided, 5655 missing), and `fear_greed_cmc` (redundant with `fear_greed_og`), the remaining 14 indicators are equally weighted. This matches the approach in `fetch_valuation_composite_data()` but with explicit exclusion of the pruned metrics in the SQL query.
- **Phase Timeline as Colored Strip**: A horizontal bar below the main chart, colored by `sdca_phase` (green=deep_discount, blue=value, gray=fair, orange=expansion, red=euphoria). Uses a lightweight `canvas` or simple CSS bars — no need for a full chart instance.
- **No Schema Changes**: The existing `unified_daily_analytics` table already stores `valuation_composite`. The value will just be computed differently (simple avg vs PCA). No migration needed.

## Risks / Trade-offs

- **[Risk] Reverting PCA means losing multicollinearity handling** → *Mitigation*: Simple average with 14 well-chosen indicators (dropping the most redundant) empirically outperforms PCA in backtesting. Multicollinearity is a second-order effect compared to signal stability.
