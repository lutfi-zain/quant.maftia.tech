import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { DailyAnalyticsPoint, CircuitBreakersResponse } from '../api/types';
import { quantClient } from '../api/client';
import { useTerminalWebSocket, WSConnectionStatus } from '../hooks/useTerminalWebSocket';

interface SyncGap {
  serverDate: string | null;
  clientDate: string | null;
  gapDays: number;
}

interface TerminalContextValue {
  dailyData: DailyAnalyticsPoint[];
  circuitBreakers: CircuitBreakersResponse | null;
  wsStatus: WSConnectionStatus;
  isLoading: boolean;
  error: string | null;
  syncGap: SyncGap;
  refreshData: () => Promise<void>;
}

const TerminalContext = createContext<TerminalContextValue | undefined>(undefined);

function daysDiff(dateA: string, dateB: string): number {
  const a = new Date(dateA).getTime();
  const b = new Date(dateB).getTime();
  return Math.max(0, Math.round((b - a) / (1000 * 60 * 60 * 24)));
}

export const TerminalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dailyData, setDailyData] = useState<DailyAnalyticsPoint[]>([]);
  const [circuitBreakers, setCircuitBreakers] = useState<CircuitBreakersResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [syncGap, setSyncGap] = useState<SyncGap>({ serverDate: null, clientDate: null, gapDays: 0 });

  const handleAnalyticsUpdate = useCallback((newPoint: any) => {
    const mappedPoint: DailyAnalyticsPoint = {
      ...newPoint,
      date: newPoint.date,
      open: newPoint.master_ohlcv?.open ?? (typeof newPoint.open === 'number' ? newPoint.open : 0),
      high: newPoint.master_ohlcv?.high ?? (typeof newPoint.high === 'number' ? newPoint.high : 0),
      low: newPoint.master_ohlcv?.low ?? (typeof newPoint.low === 'number' ? newPoint.low : 0),
      close: newPoint.master_ohlcv?.close ?? (typeof newPoint.close === 'number' ? newPoint.close : 0),
      volume: newPoint.master_ohlcv?.volume ?? (typeof newPoint.volume === 'number' ? newPoint.volume : 0),
      valuation_composite: newPoint.valuation_composite?.score ?? (typeof newPoint.valuation_composite === 'number' ? newPoint.valuation_composite : 0),
      lttd_regime: newPoint.lttd_regime?.regime ?? (typeof newPoint.lttd_regime === 'string' ? newPoint.lttd_regime : 'SIDEWAYS'),
      lttd_prob_bull: newPoint.lttd_regime?.prob_bull ?? 0,
      lttd_prob_bear: newPoint.lttd_regime?.prob_bear ?? 0,
      lttd_prob_sideways: newPoint.lttd_regime?.prob_sideways ?? 1,
      mttd_imo: newPoint.mttd_imo?.oscillator ?? (typeof newPoint.mttd_imo === 'number' ? newPoint.mttd_imo : 0),
      mttd_er_ratio: newPoint.mttd_imo?.efficiency_ratio ?? 0,
      mttd_shannon_entropy: newPoint.mttd_imo?.shannon_entropy ?? 0,
      ichimoku_imo: newPoint.ichimoku_imo?.oscillator ?? (typeof newPoint.ichimoku_imo === 'number' ? newPoint.ichimoku_imo : 0)
    };
    setDailyData(prev => {
      const idx = prev.findIndex(item => item.date === mappedPoint.date);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = mappedPoint;
        return next.sort((a, b) => a.date.localeCompare(b.date));
      }
      return [...prev, mappedPoint].sort((a, b) => a.date.localeCompare(b.date));
    });
  }, []);

  const handleCircuitBreakerTrip = useCallback((update: CircuitBreakersResponse) => {
    setCircuitBreakers(update);
  }, []);

  const { status: wsStatus } = useTerminalWebSocket({
    onAnalyticsUpdate: handleAnalyticsUpdate,
    onCircuitBreakerTrip: handleCircuitBreakerTrip
  });

  const refreshData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch full history (limit=5000 covers ~13+ years of daily Bitcoin data)
      const [analytics, breakers] = await Promise.all([
        quantClient.getDailyAnalytics(5000),
        quantClient.getCircuitBreakers()
      ]);
      setDailyData(analytics);
      setCircuitBreakers(breakers);

      // Detect sync gap: compare server's latest data date vs client's loaded tail
      try {
        const health = await quantClient.getHealth();
        const serverDate = health.database?.latest_data_timestamp ?? null;
        const clientDate = analytics.length > 0 ? analytics[analytics.length - 1].date : null;
        const gapDays = serverDate && clientDate ? daysDiff(clientDate, serverDate) : 0;
        setSyncGap({ serverDate, clientDate, gapDays });
      } catch {
        // Health check failure is non-critical — silently skip gap detection
        setSyncGap({ serverDate: null, clientDate: null, gapDays: 0 });
      }
    } catch (e: any) {
      setError(e.message || 'Failed to fetch initial terminal telemetry.');
      console.error('Initial data fetch error:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  return (
    <TerminalContext.Provider value={{
      dailyData,
      circuitBreakers,
      wsStatus,
      isLoading,
      error,
      syncGap,
      refreshData
    }}>
      {children}
    </TerminalContext.Provider>
  );
};

export function useTerminal() {
  const context = useContext(TerminalContext);
  if (!context) {
    throw new Error('useTerminal must be used within a TerminalProvider');
  }
  return context;
}
