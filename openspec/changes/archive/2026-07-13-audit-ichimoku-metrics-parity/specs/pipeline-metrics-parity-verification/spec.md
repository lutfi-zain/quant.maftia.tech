## ADDED Requirements

### Requirement: Ichimoku metric 1:1 parity validation between pipeline output and prior system

The verification harness (`verify_pipeline_api_parity.py`) SHALL extend its parity checks to include Ichimoku S-component fields (S_TK, S_Cloud, S_Future, S_Chikou) and Ichimoku line fields (tenkan_sen, kijun_sen, senkou_span_a, senkou_span_b) from the `UnifiedDailyAnalytics` table and the API Gateway response. Each numeric field SHALL match within a strict tolerance of $|a - b| < 10^{-6}$.

The Ichimoku fields to verify are:

- `ichimoku_imo` (oscillator)
- `ichi_s_tk` / `ichimoku_imo.s_tk`
- `ichi_s_cloud` / `ichimoku_imo.s_cloud`
- `ichi_s_future` / `ichimoku_imo.s_future`
- `ichi_s_chikou` / `ichimoku_imo.s_chikou`
- `ichi_tenkan` / `ichimoku_imo.tenkan`
- `ichi_kijun` / `ichimoku_imo.kijun`
- `ichi_senkou_a` / `ichimoku_imo.senkou_a`
- `ichi_senkou_b` / `ichimoku_imo.senkou_b`

#### Scenario: S-component numeric precision check between DB and API

- **WHEN** the verification harness queries `unified_daily_analytics` rows from `maftia_quant.db` and fetches the corresponding daily API response
- **THEN** every Ichimoku S-component and Ichimoku line numeric field SHALL match between the database record and API response with $|a - b| < 10^{-6}$ tolerance

#### Scenario: Categorical Ichimoku regime matching

- **WHEN** categorical fields for Ichimoku are evaluated
- **THEN** the exact strings (`BULL`, `BEAR`, `NEUTRAL`) for `ichimoku_regime` SHALL match 1:1 between database records and API responses with zero mismatches

### Requirement: Prior system output vs pipeline output cross-validation

The verification harness SHALL also validate that the Ichimoku values stored by the pipeline in `unified_daily_analytics` match the prior system's raw output DataFrame values. This SHALL be done by running the prior system's `generate_ichimoku_features()` + `generate_signals()` directly in the harness and comparing column-by-column against the pipeline's DB output.

#### Scenario: Direct comparison against prior system features

- **WHEN** the verification harness imports and runs `quant-lttd-ichimoku` feature generation on the latest OHLCV data
- **THEN** the resulting S_TK, S_Cloud, S_Future, S_Chikou, IMO, tenkan_sen, kijun_sen, senkou_span_a, senkou_span_b values SHALL match the corresponding columns in `unified_daily_analytics` with $|a - b| < 10^{-6}$ for every common date
