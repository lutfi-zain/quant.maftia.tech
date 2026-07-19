## Context

The `ValuationComposite` still suffers from three structural deficiencies. Multicollinearity among redundant indicator pairs (e.g., `fear_greed_cmc`/`fear_greed_og` at r=0.918, `dvrsi`/`risk_metrics` at r=0.902) remains unresolved after previous threshold fixes, causing composite weighting bias. The `williams_r` indicator is still truncated to `[0, +2.0]` because its native `[-100, 0]` oscillator boundaries aren't reflected in the threshold config. Several components (`dvrsi` at 92% missing, `fear_greed_cmc` at 90% missing) provide near-zero signal coverage.

## Goals / Non-Goals

**Goals:**

- Implement a PCA pre-processing layer that compresses 17 indicators into orthogonal principal components, retaining those with explained variance > 5%, before computing the `ValuationComposite` mean.
- Correct `williams_r` thresholds to map its native `[-100, 0]` range to `[-2.0, +2.0]` by setting symmetrical thresholds and enabling the `inverted` flag in the normalization logic.
- Implement data imputation fallback for `dvrsi` (daily RSI-driven) and `fear_greed_cmc` (copy from `fear_greed_og`).

**Non-Goals:**

- Removing indicators from the `unified_component_signals` table.
- Modifying the frontend chart rendering in Valuation Studio.
- Touching LTTD, MTTD, or Ichimoku systems.

## Decisions

- **Online PCA with Sliding Window**: PCA will be fit on a rolling 365-day window of non-NaN aligned component scores. A frozen projection matrix will be saved to SQLite after each pipeline run so that daily inference is reproducible.
  - *Rationale*: Avoids lookahead bias—each day's composite uses only the preceding 365 days of data. The frozen matrix ensures backward compatibility when re-computing historical scores.
- **Williams %R Inverted Normalization**: The normalization function already supports an `inverted` parameter in its auto-detection logic (when `t_plus_2 > t_minus_2`). We will set `t_plus_2 = -80, t_plus_1 = -20, t_minus_1 = -20, t_minus_2 = -80` so the native oscillator range is fully mapped.
  - *Rationale*: This leverages existing code without adding new logic.
- **DVRSI Imputation via Daily RSI**: When DVRSI is NaN for a day, compute `ta-lib` RSI on daily closes (window=14) and normalize through the existing DVRSI thresholds.
  - *Rationale*: DVRSI is already a weekly RSI variant. Using daily RSI as a proxy preserves the same statistical family.

## Risks / Trade-offs

- **[Risk] PCA projection changes backward compatibility** → *Mitigation*: The projection matrix is frozen per pipeline run, and historical composites are recomputed on each full rebuild, ensuring consistency.
- **[Risk] Daily RSI imputation diverges from native DVRSI** → *Mitigation*: Imputation only fires for missing values; dates with native DVRSI values keep their original scores.
- **[Risk] Fear & Greed CMC→OG copy propagates stale sentiment** → *Mitigation*: The two series have r=0.918; this is a conservative fallback that only activates when CMC data is unavailable.
