## MODIFIED Requirements

### Requirement: Unified Daily Analytics and Component Signals Endpoints
The API Gateway SHALL provide standardized REST routes (`/api/v1/analytics/daily`, `/api/v1/quant/daily`, and `/api/v1/analytics/components`) querying `UnifiedDailyAnalytics` (`unified_daily_analytics`) and `UnifiedComponentSignals` (`unified_component_signals`) inside `/home/ubuntu/projects/quant.maftia.tech/data/maftia_quant.db` strictly via `?-style` parameterized SQL queries with SQLite WAL concurrency (`PRAGMA journal_mode=WAL; PRAGMA query_only=true;`). The routes SHALL enforce strict $t-1$ `CausalFilter` date bounds ($date \le \text{today}$) to prevent lookahead bias. Furthermore, when returning daily analytics objects for `ichimoku_imo`, the API Gateway MUST include `entropy` (`ichi_entropy`), `er` (`ichi_er`), and `imo_std` (`ichi_imo_std`) alongside `oscillator`, `regime`, `position`, `s_tk`, `s_cloud`, `s_future`, `s_chikou`, `tenkan`, `kijun`, `senkou_a`, `senkou_b`, and `chikou`.

#### Scenario: Consolidated multi-system query with causal verification
- **WHEN** a GET request is sent to `/api/v1/analytics/daily?start_date=2024-01-01` or `/api/v1/quant/daily`
- **THEN** the gateway MUST execute a `?-style` parameterized query against `maftia_quant.db` in read-only WAL mode, filter timestamps where $date \le \text{today}$, and return a consolidated JSON payload joining daily dates to `MasterOHLCV` prices and outputs from `ValuationComposite`, `LTTDRegime`, `MTTDIntegratedOscillator`, and `IchimokuDenoisedOscillator` where `ichimoku_imo` contains `{ oscillator, regime, position, s_tk, s_cloud, s_future, s_chikou, tenkan, kijun, senkou_a, senkou_b, chikou, entropy, er, imo_std }`

#### Scenario: Granular component signals query across systems
- **WHEN** a GET request is sent to `/api/v1/analytics/components?system=VALUATION&date=2026-07-08`
- **THEN** the gateway MUST execute a `?-style` parameterized query against `unified_component_signals` and return all matching indicator rows (`component_name`, `raw_value`, `normalized_score`, `signal_direction`) without lock contention
