import { useEffect, useRef, useCallback, useState } from 'react';
import type { User, ChatMessage, ServerEvent } from '../types';

interface UseSignalingConfig {
  serverUrl: string;
  onMessage: (event: ServerEvent) => void;
}

interface UseSignalingReturn {
  connect: (userId: string) => void;
  disconnect: () => void;
  send: (message: object) => void;
  isConnected: boolean;
  error: string | null;
}

export function useSignaling(config: UseSignalingConfig): UseSignalingReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userIdRef = useRef<string>('');
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldReconnectRef = useRef(false);

  const onMessageRef = useRef(config.onMessage);
  onMessageRef.current = config.onMessage;

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const parsed: ServerEvent = JSON.parse(event.data);
      onMessageRef.current(parsed);
    } catch (err) {
      console.error('[Signaling] Failed to parse message:', err);
    }
  }, []);

  const connect = useCallback((userId: string) => {
    userIdRef.current = userId;
    shouldReconnectRef.current = true;

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const ws = new WebSocket(config.serverUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[Signaling] Connected to server');
        setIsConnected(true);
        setError(null);
      };

      ws.onmessage = handleMessage;

      ws.onclose = (event) => {
        console.log('[Signaling] Disconnected:', event.code, event.reason);
        setIsConnected(false);

        if (shouldReconnectRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            if (shouldReconnectRef.current && userIdRef.current) {
              console.log('[Signaling] Attempting reconnection...');
              connect(userIdRef.current);
            }
          }, 3000);
        }
      };

      ws.onerror = (event) => {
        console.error('[Signaling] Error:', event);
        setError('WebSocket connection error');
      };
    } catch (err) {
      console.error('[Signaling] Failed to create connection:', err);
      setError('Failed to create WebSocket connection');
    }
  }, [config.serverUrl, handleMessage]);

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const send = useCallback((message: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  useEffect(() => {
    return () => {
      shouldReconnectRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return { connect, disconnect, send, isConnected, error };
}
