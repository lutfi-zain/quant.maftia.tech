## ADDED Requirements

### Requirement: Tactical Sentiment Decoupling
The `quant-btc-valuation-system` SHALL classify indicators into `macro_valuation` and `tactical_sentiment` layers in `metric_config`. Tactical short-term indicators (`fear_greed_og`, `fear_greed_cmc`, `williams_r`, `dvrsi`, `sharpe_ratio_52w`) SHALL be processed and stored in `timeseries_metrics` and `unified_component_signals`, but SHALL NOT be included in the arithmetic mean calculation for `ValuationComposite`.

#### Scenario: Tactical indicator exclusion from macro composite
- **WHEN** the daily valuation pipeline aggregates component scores into `ValuationComposite`
- **THEN** it filters component scores strictly for indicators tagged with `category_layer == 'macro_valuation'`, excluding `tactical_sentiment` indicators from contaminating the macro score.
