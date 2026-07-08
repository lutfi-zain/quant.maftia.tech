export interface DailyAnalyticsPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  valuation_composite: number;
  lttd_regime: 'BULL' | 'BEAR' | 'SIDEWAYS';
  mttd_imo: number;
  ichimoku_imo: number;
  // Additional internal details if returned
  lttd_prob_bull?: number;
  lttd_prob_bear?: number;
  lttd_prob_sideways?: number;
  mttd_er_ratio?: number;
  mttd_shannon_entropy?: number;
  ichimoku_s_tk?: number;
  ichimoku_s_cloud?: number;
  ichimoku_s_future?: number;
  ichimoku_s_chikou?: number;
}

export interface CircuitBreakersResponse {
  date: string;
  valuation_circuit_breaker: {
    is_bubble_risk: boolean;
    is_deep_discount: boolean;
    composite_score: number;
    thresholds: { bubble: number; discount: number };
  };
  lttd_macro_override: {
    is_sideways_override: boolean;
    regime: 'BULL' | 'BEAR' | 'SIDEWAYS';
    exposure_multiplier: number;
    probability_sideways: number;
  };
  mttd_consensus_gates: {
    er_gate_open: boolean;
    shannon_entropy_gate_open: boolean;
    chikou_momentum_exit: boolean;
    efficiency_ratio: number;
    shannon_entropy: number;
  };
  system_status: 'NORMAL' | 'WARNING' | 'OVERRIDE_ACTIVE';
  causal_filter_verified: boolean;
}

export interface ComponentSignal {
  date: string;
  system_source: string;
  component_name: string;
  normalized_score: number;
  signal_direction: -1 | 0 | 1;
  raw_value?: number;
}

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'error';
  service: string;
  port: number;
  database_wal: boolean;
  causal_filter: string;
  timestamp: string;
}
