## Context

The `quant-lttd-ichimoku` system (prior standalone project at `/home/ubuntu/projects/quant-lttd-ichimoku`) is the authoritative source of truth for Ichimoku-based quantitative metrics. Its `features.py` computes hyper-tuned Ichimoku components using periods (p1=20, p2=60, p3=120) optimized for 24/7 crypto markets, with Ehlers SuperSmoother IIR denoising and tanh normalization producing bounded `[-1.0, +1.0]` S-components (S_TK, S_Cloud, S_Future, S_Chikou) and the composite IMO oscillator.

The current unified platform has three independent data pathways — each with different periods, different computation, and different results:

| Pathway | Periods | Computation | Source |
|---------|---------|-------------|--------|
| **Prior System** (quant-lttd-ichimoku) | 20, 60, 120 | Ehlers SuperSmoother + tanh | `features.py` |
| **Unified Pipeline** (run_report_pipeline.py) | 20, 60, 120 | Same as prior (imports it) | `ich_data_all` dict → DB |
| **FE Client-side** (IchimokuTerminal.tsx) | 9, 26, 52 | Raw min/max midpoint | `computeIchimokuLines()` |

The pipeline correctly computes Ichimoku metrics using the prior system, but only stores `ichimoku_imo`, `ichimoku_regime`, and `ichimoku_position` in the database. The S-components (ichi_s_tk, ichi_s_cloud, ichi_s_future, ichi_s_chikou) — which already exist as columns in `unified_daily_analytics` — are never populated. The FE compensates with synthetic data, breaking the data integrity chain.

This design restores a single authoritative data flow: **Prior System → Pipeline → Database → API → FE Terminal — no client-side recomputation**.

## Goals / Non-Goals

**Goals:**

- Unify all Ichimoku chart data to flow through the canonical pipeline — no client-side period divergence.
- Populate `unified_daily_analytics.ichi_s_tk`, `ichi_s_cloud`, `ichi_s_future`, `ichi_s_chikou` from the prior system's output.
- Sync Ichimoku S-components into `unified_component_signals` with `system_source='ICHIMOKU'`.
- Return S-components in the `/api/v1/quant/daily` API response.
- Fix `IchimokuTerminal` to use API-provided values — no synthetic fallback, no client-side period drift.
- Update the Ichimoku lines overlay to use the prior system's periods (20, 60, 120) served via API.
- Verify parity end-to-end.

**Non-Goals:**

- No changes to `quant-lttd-ichimoku` source code (`features.py`, `strategy.py`, `server.py`).
- No changes to MTTD system's Ichimoku computation or its signals.
- No changes to Valuation or LTTD systems.
- No new frontend features or UI redesign — only metric correctness correction.

## Decisions

### D1: Serve Ichimoku Lines via API Instead of Client-side Computation

**Decision:** Add tenkan_sen, kijun_sen, senkou_span_a, senkou_span_b fields to the `unified_daily_analytics` table and populate them from the prior system during pipeline sync. The API returns these. The FE reads them instead of computing client-side.

**Rationale:** Eliminates period drift permanently. The prior system already computes tenkan_sen, kijun_sen, senkou_span_a, senkou_span_b in `features.py` with the correct hyper-tuned periods. Serving them through the pipeline ensures a single source of truth. The API response format naturally extends to include these fields alongside the existing OHLCV data.

**Alternatives Considered:**

- *Fix client-side periods to (20, 60, 120)* — simpler but still decoupled from the prior system. Any future period tweak in the prior system would require syncing the FE change. Rejected because it doesn't solve the root cause.
- *FE fetches directly from prior system's FastAPI server* — violates the unified API Gateway rule (`:8765`). Rejected.

### D2: Extend Existing `unified_daily_analytics` Columns Rather Than a Separate Table

**Decision:** Use the existing `ichi_s_tk`, `ichi_s_cloud`, `ichi_s_future`, `ichi_s_chikou` columns (already present in the DB schema but NULL) plus add new columns for tenkan_sen, kijun_sen, senkou_span_a, senkou_span_b to the same table.

**Rationale:** These are per-date values that naturally align with the existing daily analytics row. A separate table would require JOINs on every daily query, adding latency to the API. The columns already exist for S-components; adding 4 more Ichimoku line columns is proportional (`ichi_tenkan`, `ichi_kijun`, `ichi_senkou_a`, `ichi_senkou_b`).

**Alternatives Considered:**

- *New `ichimoku_raw_lines` table* — cleaner separation of concern but requires JOIN overhead on every chart render. Rejected for performance.
- *Only store in `unified_component_signals`* — this table stores normalized scores, not raw price-level values. Tenkan/Kijun are price-level (not normalized), so this table is inappropriate.

### D3: Extract S-Components Directly from Prior System's DataFrame in Pipeline

**Decision:** In `run_report_pipeline.py`, when the Ichimoku system runs (`python3 main.py`), the `generate_ichimoku_features()` function already computes all S-components and Ichimoku lines. The pipeline will capture the full DataFrame (already available as `df_ich`) and extract the additional columns at sync time.

**Rationale:** The pipeline already imports and calls the prior system's modules directly:

```python
from src.ichimoku_quant.data import fetch_btc_data
from src.ichimoku_quant.features import generate_ichimoku_features
from src.ichimoku_quant.strategy import generate_signals
```

The resulting `df_ich` DataFrame contains tenkan_sen, kijun_sen, senkou_span_a, senkou_span_b, S_TK, S_Cloud, S_Future, S_Chikou. This is the most reliable extraction point — zero serialization overhead, exact 1:1 values.

**Alternatives Considered:**

- *Parse the prior system's cache CSV* — fragile to format changes. Rejected.
- *Re-compute Ichimoku lines in a shared library* — architectural duplication. The prior system is the authority. Rejected.

### D4: ICHIMOKU Component Signals Must be Distinct from MTTD Source

**Decision:** When syncing `unified_component_signals`, Ichimoku system S-components MUST use `system_source='ICHIMOKU'` and MTTD system S-components must retain `system_source='MTTD'`. The FE reads 'ICHIMOKU'-sourced signals for the Ichimoku Terminal.

**Rationale:** The MTTD system computes its own S_TK, S_Cloud, S_Future, S_Chikou using different parameters. These are NOT equivalent to the Ichimoku system's values. The system_source field is the discriminator. If both populate the same component_name, the `PRIMARY KEY (date, system_source, component_name)` ensures no collision.

## Data Flow

```
quant-lttd-ichimoku (features.py)
  ├── generate_ichimoku_features(df)
  │   ├── tenkan_sen, kijun_sen        (periods 20, 60)
  │   ├── senkou_span_a, senkou_span_b (periods 60, 120)
  │   ├── S_TK, S_Cloud, S_Future, S_Chikou  (tanh-normalized)
  │   ├── IMO, IMO_Std, ER, Entropy
  │   └── via generate_signals() → Pos, Regime
  │
  └── run_report_pipeline.py (sync)
      ├── unified_daily_analytics ← ichimoku_imo, ichimoku_regime, ichimoku_position,
      │                              ichi_s_tk, ichi_s_cloud, ichi_s_future, ichi_s_chikou,
      │                              ichi_tenkan, ichi_kijun, ichi_senkou_a, ichi_senkou_b
      ├── unified_component_signals (source='ICHIMOKU')
      │   ├── S_TK, S_Cloud, S_Future, S_Chikou
      │   └── IMO
      │
      └── API Gateway (:8765)
          ├── GET /api/v1/quant/daily
          │   └── ichimoku_imo: { oscillator, regime, position,
          │                        s_tk, s_cloud, s_future, s_chikou,
          │                        tenkan, kijun, senkou_a, senkou_b }
          │
          └── FE Client → IchimokuTerminal
              ├── BTC pane: candlesticks + Ichimoku lines (from API)
              ├── IMO pane: IMO oscillator (from API)
              └── S-Comp pane: S_TK, S_Cloud, S_Future, S_Chikou (from API)
```

## API Contract: Current vs Desired Response Format

### `GET /api/v1/quant/daily` — one row response (current)

```json
{
  "date": "2026-07-11",
  "master_ohlcv": { "open": 67890, "high": 69000, "low": 67500, "close": 68500, "volume": 123456789 },
  "ichimoku_imo": {
    "oscillator": -0.9896,
    "regime": "NEUTRAL",
    "position": 0
  }
  // No S-components, no Ichimoku lines
}
```

**Problem:** `ichimoku_imo` object has 3 fields. Missing: s_tk, s_cloud, s_future, s_chikou, tenkan, kijun, senkou_a, senkou_b, chikou.

### `GET /api/v1/quant/daily` — one row response (desired)

```json
{
  "date": "2026-07-11",
  "master_ohlcv": { "open": 67890, "high": 69000, "low": 67500, "close": 68500, "volume": 123456789 },
  "ichimoku_imo": {
    "oscillator": -0.9896,
    "regime": "NEUTRAL",
    "position": 0,
    "s_tk": -0.7234,
    "s_cloud": -0.8912,
    "s_future": -0.6543,
    "s_chikou": -0.9123,
    "tenkan": 62150.0,
    "kijun": 64800.0,
    "senkou_a": 63500.0,
    "senkou_b": 67200.0,
    "chikou": 69100.0
  }
}
```

**Principle:** All Ichimoku values live under the existing `ichimoku_imo` sub-object to preserve the existing API contract structure. The FE client already destructures `item.ichimoku_imo?.oscillator`; it will extend to read all 12 fields.

### `GET /api/v1/quant/components?system=quant-lttd-ichimoku` (current)

```json
{
  "status": "success",
  "count": 0,
  "data": []
}
```

**Problem:** No ICHIMOKU source records in `unified_component_signals`. FE calls this but gets nothing, forcing synthetic fallback.

### `GET /api/v1/quant/components?system=quant-lttd-ichimoku` (desired)

```json
{
  "status": "success",
  "count": 5,
  "data": [
    { "date": "2026-07-11", "system_source": "ICHIMOKU", "component_name": "IMO", "raw_value": null, "normalized_score": -0.9896, "signal_direction": -1 },
    { "date": "2026-07-11", "system_source": "ICHIMOKU", "component_name": "S_TK", "raw_value": -0.7234, "normalized_score": -0.7234, "signal_direction": -1 },
    { "date": "2026-07-11", "system_source": "ICHIMOKU", "component_name": "S_Cloud", ... },
    { "date": "2026-07-11", "system_source": "ICHIMOKU", "component_name": "S_Future", ... },
    { "date": "2026-07-11", "system_source": "ICHIMOKU", "component_name": "S_Chikou", ... }
  ]
}
```

### FE `DailyAnalyticsPoint` Type Fields (what the FE expects)

```typescript
interface DailyAnalyticsPoint {
  // Current: exists and populated
  ichimoku_imo: number;

  // Current: exists as optional but NEVER populated by API
  ichimoku_s_tk?: number;
  ichimoku_s_cloud?: number;
  ichimoku_s_future?: number;
  ichimoku_s_chikou?: number;

  // MISSING: don't exist yet, needed for Ichimoku lines overlay
  ichimoku_tenkan?: number;
  ichimoku_kijun?: number;
  ichimoku_senkou_a?: number;
  ichimoku_senkou_b?: number;
  ichimoku_chikou?: number;
}
```

### FE `client.ts` Mapping — What Must Change

```typescript
// Current: only 1 field from ichimoku_imo
ichimoku_imo: item.ichimoku_imo?.oscillator ?? 0

// Desired: all 12 fields
ichimoku_imo: item.ichimoku_imo?.oscillator ?? 0,
ichimoku_s_tk: item.ichimoku_imo?.s_tk,
ichimoku_s_cloud: item.ichimoku_imo?.s_cloud,
ichimoku_s_future: item.ichimoku_imo?.s_future,
ichimoku_s_chikou: item.ichimoku_imo?.s_chikou,
ichimoku_tenkan: item.ichimoku_imo?.tenkan,
ichimoku_kijun: item.ichimoku_imo?.kijun,
ichimoku_senkou_a: item.ichimoku_imo?.senkou_a,
ichimoku_senkou_b: item.ichimoku_imo?.senkou_b,
ichimoku_chikou: item.ichimoku_imo?.chikou,
```

## Risks / Trade-offs

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Pipeline execution time increase** | Sync more columns, more INSERT/ORREPLACE operations | Negligible — the data is already in memory (`df_ich`), only ~3 additional INSERT columns per date row |
| **API response payload size** | Adding 8+ new fields per daily point (~15-20% increase) | Acceptable for daily-resolution data. If bandwidth becomes a concern, add `?fields=basic,ichimoku` field-selector in a future change |
| **Existing DB has NULL S-components** | After deployment, historical NULLs remain until next full pipeline run | The pipeline upserts all dates on each run, so historical rows will be populated gradually. No migration needed — existing queries handle NULL gracefully |
| **FE chart re-initialization** | Changing data source from client-computed to API-served may cause visual flicker | The chart already re-initializes on `dailyData` changes via useEffect. No additional risk — same pattern used by MTTD and Valuation studios |
| **Ichimoku lines on BTC pane become unavailable during pipeline failure** | FE shows only candlesticks | Same failure mode as IMO and S-components. The API returns NULLs, FE should handle with graceful degradation (hide lines) |
