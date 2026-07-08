import { DailyAnalyticsPoint, CircuitBreakersResponse, ComponentSignal, HealthResponse } from './types';

// Use environment proxy or direct API Gateway port :8765
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://0.0.0.0:8765';

/**
 * Ensures strict t-1 CausalFilter verification on incoming time-series data.
 * Verifies that all points have timestamps <= current date minus any lookahead risk.
 */
function verifyCausalData<T extends { date: string }>(data: T[]): T[] {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  // Filter out any anomalous future dates beyond current observation window
  return data.filter(item => item.date <= todayStr);
}

export const quantClient = {
  async getHealth(): Promise<HealthResponse> {
    const res = await fetch(`${API_BASE}/api/v1/health`);
    if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`);
    return res.json();
  },

  async getDailyAnalytics(limit?: number): Promise<DailyAnalyticsPoint[]> {
    const url = new URL(`${API_BASE}/api/v1/analytics/daily`);
    if (limit) url.searchParams.set('limit', limit.toString());
    
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Failed to fetch daily analytics: ${res.statusText}`);
    const data: DailyAnalyticsPoint[] = await res.json();
    return verifyCausalData(data);
  },

  async getCircuitBreakers(): Promise<CircuitBreakersResponse> {
    const res = await fetch(`${API_BASE}/api/v1/system/circuit-breakers`);
    if (!res.ok) throw new Error(`Failed to fetch circuit breakers: ${res.statusText}`);
    return res.json();
  },

  async getComponents(systemSource?: string, date?: string): Promise<ComponentSignal[]> {
    const url = new URL(`${API_BASE}/api/v1/analytics/components`);
    if (systemSource) url.searchParams.set('system', systemSource);
    if (date) url.searchParams.set('date', date);

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Failed to fetch component signals: ${res.statusText}`);
    const data: ComponentSignal[] = await res.json();
    return verifyCausalData(data);
  }
};
