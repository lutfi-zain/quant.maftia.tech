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

  const handleAnalyticsUpdate = useCallback((newPoint: DailyAnalyticsPoint) => {
    setDailyData(prev => {
      // Replace if date exists, otherwise append
      const idx = prev.findIndex(item => item.date === newPoint.date);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = newPoint;
        return next.sort((a, b) => a.date.localeCompare(b.date));
      }
      return [...prev, newPoint].sort((a, b) => a.date.localeCompare(b.date));
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
