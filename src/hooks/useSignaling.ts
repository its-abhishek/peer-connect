import { useEffect, useRef, useCallback, useState } from 'react';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase';
import type { ServerEvent, User, DbMessage } from '../types';

interface UseSignalingConfig {
  onMessage: (event: ServerEvent) => void;
}

interface UseSignalingReturn {
  connect: (roomId: string) => Promise<void>;
  disconnect: () => void;
  send: (message: object) => void;
  isConnected: boolean;
  error: string | null;
}

export function useSignaling(config: UseSignalingConfig): UseSignalingReturn {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onMessageRef = useRef(config.onMessage);
  onMessageRef.current = config.onMessage;

  const connect = useCallback((roomId: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }

      setError(null);
      setIsConnected(false);

      // Timeout after 5 seconds
      const timeoutId = setTimeout(() => {
        reject(new Error('Signaling connection timeout'));
      }, 5000);

      const channel = supabase.channel(`room:${roomId}`, {
        config: { broadcast: { self: false } },
      });

      channel
        .on('broadcast', { event: 'signal' }, ({ payload }) => {
          onMessageRef.current(payload as ServerEvent);
        })
        .on('broadcast', { event: 'chat' }, ({ payload }) => {
          onMessageRef.current({
            type: 'chat-message',
            payload,
          });
        })
        .on('broadcast', { event: 'user-joined' }, ({ payload }) => {
          onMessageRef.current(payload as ServerEvent);
        })
        .on('broadcast', { event: 'user-left' }, ({ payload }) => {
          onMessageRef.current(payload as ServerEvent);
        })
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `room_id=eq.${roomId}`,
          },
          (payload: RealtimePostgresChangesPayload<DbMessage>) => {
            if (payload.new && typeof payload.new === 'object') {
              const msg = payload.new as DbMessage;
              onMessageRef.current({
                type: 'chat-message',
                payload: {
                  id: msg.id.toString(),
                  userId: msg.user_id,
                  displayName: msg.display_name || 'Unknown',
                  text: msg.content,
                  timestamp: new Date(msg.created_at).getTime(),
                  type: msg.type,
                },
              });
            }
          },
        )
        .subscribe((status) => {
          console.log('[Signaling] Channel status:', status);
          if (status === 'SUBSCRIBED') {
            clearTimeout(timeoutId);
            setIsConnected(true);
            setError(null);
            resolve();
          } else if (status === 'CHANNEL_ERROR') {
            clearTimeout(timeoutId);
            setError('Failed to connect to signaling channel');
            setIsConnected(false);
            reject(new Error('Channel error'));
          } else if (status === 'CLOSED') {
            setIsConnected(false);
          }
        });

      channelRef.current = channel;
    });
  }, []);

  const disconnect = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setIsConnected(false);
    setError(null);
  }, []);

  const send = useCallback((message: object) => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'signal',
        payload: message,
      });
    }
  }, []);

  useEffect(() => {
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  return { connect, disconnect, send, isConnected, error };
}
