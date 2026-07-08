import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { DailyAnalyticsPoint, CircuitBreakersResponse } from '../api/types';
import { quantClient } from '../api/client';
import { useTerminalWebSocket, WSConnectionStatus } from '../hooks/useTerminalWebSocket';

interface TerminalContextValue {
  dailyData: DailyAnalyticsPoint[];
  circuitBreakers: CircuitBreakersResponse | null;
  wsStatus: WSConnectionStatus;
  isLoading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
}

const TerminalContext = createContext<TerminalContextValue | undefined>(undefined);

export const TerminalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dailyData, setDailyData] = useState<DailyAnalyticsPoint[]>([]);
  const [circuitBreakers, setCircuitBreakers] = useState<CircuitBreakersResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyticsUpdate = useCallback((newPoint: any) => {
    const mappedPoint: DailyAnalyticsPoint = {
      date: newPoint.date,
      open: newPoint.master_ohlcv?.open ?? newPoint.open ?? 0,
      high: newPoint.master_ohlcv?.high ?? newPoint.high ?? 0,
      low: newPoint.master_ohlcv?.low ?? newPoint.low ?? 0,
      close: newPoint.master_ohlcv?.close ?? newPoint.close ?? 0,
      volume: newPoint.master_ohlcv?.volume ?? newPoint.volume ?? 0,
      valuation_composite: newPoint.valuation_composite?.score ?? newPoint.valuation_composite ?? 0,
      lttd_regime: newPoint.lttd_regime?.regime ?? newPoint.lttd_regime ?? 'SIDEWAYS',
      lttd_prob_bull: newPoint.lttd_regime?.prob_bull ?? 0,
      lttd_prob_bear: newPoint.lttd_regime?.prob_bear ?? 0,
      lttd_prob_sideways: newPoint.lttd_regime?.prob_sideways ?? 1,
      mttd_imo: newPoint.mttd_imo?.oscillator ?? newPoint.mttd_imo ?? 0,
      mttd_er_ratio: newPoint.mttd_imo?.efficiency_ratio ?? 0,
      mttd_shannon_entropy: newPoint.mttd_imo?.shannon_entropy ?? 0,
      ichimoku_imo: newPoint.ichimoku_imo?.oscillator ?? newPoint.ichimoku_imo ?? 0,
      ...newPoint
    };
    setDailyData(prev => {
      // Replace if date exists, otherwise append
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
      setError(null);
      const [analytics, breakers] = await Promise.all([
        quantClient.getDailyAnalytics(365),
        quantClient.getCircuitBreakers()
      ]);
      setDailyData(analytics);
      setCircuitBreakers(breakers);
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
