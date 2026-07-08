import { useEffect, useRef, useState, useCallback } from 'react';
import { DailyAnalyticsPoint, CircuitBreakersResponse } from '../api/types';

export type WSConnectionStatus = 'Connected' | 'Reconnecting' | 'Disconnected';

interface UseTerminalWebSocketOptions {
  onAnalyticsUpdate?: (data: DailyAnalyticsPoint) => void;
  onCircuitBreakerTrip?: (data: CircuitBreakersResponse) => void;
}

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://0.0.0.0:8765/ws/live';

export function useTerminalWebSocket(options?: UseTerminalWebSocketOptions) {
  const [status, setStatus] = useState<WSConnectionStatus>('Disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const retryCountRef = useRef<number>(0);
  const timeoutRef = useRef<any>(null);

  const connect = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      setStatus(retryCountRef.current > 0 ? 'Reconnecting' : 'Disconnected');
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('Connected');
        retryCountRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'analytics_update' && message.payload) {
            options?.onAnalyticsUpdate?.(message.payload);
          } else if (message.type === 'circuit_breaker_trip' && message.payload) {
            options?.onCircuitBreakerTrip?.(message.payload);
          }
        } catch (e) {
          console.error('Failed to parse WebSocket broadcast:', e);
        }
      };

      ws.onclose = () => {
        setStatus('Reconnecting');
        wsRef.current = null;
        scheduleReconnect();
      };

      ws.onerror = () => {
        // onerror is typically followed by onclose where reconnection is scheduled
        if (ws.readyState !== WebSocket.CLOSED) {
          ws.close();
        }
      };
    } catch (e) {
      setStatus('Reconnecting');
      scheduleReconnect();
    }
  }, [options]);

  const scheduleReconnect = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    // Exponential backoff up to 10 seconds (10000 ms)
    const baseDelay = 1000;
    const maxDelay = 10000;
    const delay = Math.min(baseDelay * Math.pow(1.5, retryCountRef.current), maxDelay);
    retryCountRef.current += 1;

    timeoutRef.current = setTimeout(() => {
      connect();
    }, delay);
  }, [connect]);

  useEffect(() => {
    connect();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // Prevent reconnect on unmount
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { status };
}
