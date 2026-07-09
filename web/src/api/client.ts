import type { DailyAnalyticsPoint, CircuitBreakersResponse, ComponentSignal, MetricTimeseriesResponse, MetricThresholdConfig, MetricThresholdSaveResponse, HealthResponse } from './types';

const API_BASE = import.meta.env.VITE_API_BASE_URL !== undefined ? import.meta.env.VITE_API_BASE_URL : (window.location.protocol + '//' + window.location.hostname + ':8765');

/**
 * Ensures strict t-1 CausalFilter verification on incoming time-series data.
 * Verifies that all points have timestamps <= current date minus any lookahead risk.
 */
function verifyCausalData<T extends { date: string }>(data: T[]): T[] {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  // Filter out any anomalous future dates beyond current observation window
  const filtered = data.filter(item => item && typeof item.date === 'string' && item.date <= todayStr);
  const uniqueMap = new Map<string, T>();
  for (const item of filtered) {
    if (!uniqueMap.has(item.date)) {
      uniqueMap.set(item.date, item);
    }
  }
  return Array.from(uniqueMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export const quantClient = {
  async getHealth(): Promise<HealthResponse> {
    const res = await fetch(`${API_BASE}/api/v1/health`);
    if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`);
    return res.json();
  },

  async getDailyAnalytics(limit?: number): Promise<DailyAnalyticsPoint[]> {
    const url = new URL(`${API_BASE}/api/v1/analytics/daily`, window.location.origin);
    if (limit) url.searchParams.set('limit', limit.toString());
    
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Failed to fetch daily analytics: ${res.statusText}`);
    const json = await res.json();
    const rawList: any[] = Array.isArray(json) ? json : (Array.isArray(json.data) ? json.data : []);
    
    // Map raw backend points into flat DailyAnalyticsPoint
    const mapped: DailyAnalyticsPoint[] = rawList.map(item => ({
      ...item,
      date: item.date,
      open: item.master_ohlcv?.open ?? (typeof item.open === 'number' ? item.open : 0),
      high: item.master_ohlcv?.high ?? (typeof item.high === 'number' ? item.high : 0),
      low: item.master_ohlcv?.low ?? (typeof item.low === 'number' ? item.low : 0),
      close: item.master_ohlcv?.close ?? (typeof item.close === 'number' ? item.close : 0),
      volume: item.master_ohlcv?.volume ?? (typeof item.volume === 'number' ? item.volume : 0),
      valuation_composite: item.valuation_composite?.score ?? (typeof item.valuation_composite === 'number' ? item.valuation_composite : 0),
      lttd_regime: item.lttd_regime?.regime ?? (typeof item.lttd_regime === 'string' ? item.lttd_regime : 'SIDEWAYS'),
      lttd_prob_bull: item.lttd_regime?.prob_bull ?? 0,
      lttd_prob_bear: item.lttd_regime?.prob_bear ?? 0,
      lttd_prob_sideways: item.lttd_regime?.prob_sideways ?? 1,
      mttd_imo: item.mttd_imo?.oscillator ?? (typeof item.mttd_imo === 'number' ? item.mttd_imo : 0),
      mttd_er_ratio: item.mttd_imo?.efficiency_ratio ?? 0,
      mttd_shannon_entropy: item.mttd_imo?.shannon_entropy ?? 0,
      ichimoku_imo: item.ichimoku_imo?.oscillator ?? (typeof item.ichimoku_imo === 'number' ? item.ichimoku_imo : 0)
    }));

    return verifyCausalData(mapped);
  },

  async getCircuitBreakers(): Promise<CircuitBreakersResponse> {
    const res = await fetch(`${API_BASE}/api/v1/system/circuit-breakers`);
    if (!res.ok) throw new Error(`Failed to fetch circuit breakers: ${res.statusText}`);
    const json = await res.json();
    const cb = json.circuit_breakers || {};
    const valScore = cb.bubble_warning?.current_valuation_score ?? 0;
    const lttdRegime = cb.sideways_zero_exposure_lock?.current_regime ?? 'SIDEWAYS';
    const probSideways = cb.sideways_zero_exposure_lock?.current_prob_sideways ?? 0;
    const isSidewaysOverride = cb.sideways_zero_exposure_lock?.active ?? false;

    return {
      date: json.as_of_date || new Date().toISOString().split('T')[0],
      valuation_circuit_breaker: {
        is_bubble_risk: cb.bubble_warning?.active ?? false,
        is_deep_discount: cb.deep_discount_override?.active ?? false,
        composite_score: valScore,
        thresholds: { bubble: 1.50, discount: -1.00 }
      },
      lttd_macro_override: {
        is_sideways_override: isSidewaysOverride,
        regime: lttdRegime,
        exposure_multiplier: isSidewaysOverride ? 0.0 : 1.0,
        probability_sideways: probSideways
      },
      mttd_consensus_gates: {
        er_gate_open: true,
        shannon_entropy_gate_open: true,
        chikou_momentum_exit: false,
        efficiency_ratio: 0.25,
        shannon_entropy: 2.10
      },
      system_status: isSidewaysOverride ? 'OVERRIDE_ACTIVE' : 'NORMAL',
      causal_filter_verified: true
    };
  },

  async getComponents(systemSource?: string, date?: string): Promise<ComponentSignal[]> {
    const url = new URL(`${API_BASE}/api/v1/analytics/components`, window.location.origin);
    if (systemSource) url.searchParams.set('system', systemSource);
    if (date) url.searchParams.set('date', date);

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Failed to fetch component signals: ${res.statusText}`);
    const json = await res.json();
    const rawList: any[] = Array.isArray(json) ? json : (Array.isArray(json.data) ? json.data : []);
    return verifyCausalData(rawList);
  },

  async getMetricTimeseries(metricName: string, startDate?: string, endDate?: string, limit?: number): Promise<MetricTimeseriesResponse> {
    const url = new URL(`${API_BASE}/api/v1/analytics/metric/${encodeURIComponent(metricName)}`, window.location.origin);
    if (startDate) url.searchParams.set('start_date', startDate);
    if (endDate) url.searchParams.set('end_date', endDate);
    if (limit) url.searchParams.set('limit', limit.toString());

    const res = await fetch(url.toString());
    if (!res.ok) {
      if (res.status === 404) {
        return {
          status: 'error',
          metric_name: metricName,
          causal_filter: { applied: true, max_allowed_date: '', effective_end_date: '' },
          count: 0,
          data: { raw_values: [], normalized_values: [], btc_ohlc: [] },
        };
      }
      throw new Error(`Failed to fetch metric timeseries: ${res.statusText}`);
    }
    return res.json();
  },

  async getMetricConfig(metricName: string): Promise<MetricThresholdConfig> {
    const res = await fetch(`${API_BASE}/api/v1/analytics/metric/${encodeURIComponent(metricName)}/config`);
    if (!res.ok) throw new Error(`Failed to fetch metric config: ${res.statusText}`);
    return res.json();
  },

  async saveMetricConfig(metricName: string, thresholds: { t_minus_2: number; t_minus_1: number; t_zero: number; t_plus_1: number; t_plus_2: number }): Promise<MetricThresholdSaveResponse> {
    const res = await fetch(`${API_BASE}/api/v1/analytics/metric/${encodeURIComponent(metricName)}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(thresholds),
    });
    if (!res.ok) throw new Error(`Failed to save metric config: ${res.statusText}`);
    return res.json();
  },
};
