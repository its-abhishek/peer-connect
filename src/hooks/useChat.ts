import { useState, useCallback, useRef } from 'react';
import { supabase } from '../utils/supabase';
import type { ChatMessage } from '../types';

interface UseChatReturn {
  messages: ChatMessage[];
  sendMessage: (roomId: string, userId: string, displayName: string, text: string) => void;
  addSystemMessage: (text: string, type: 'join' | 'leave') => void;
  addRemoteMessage: (msg: ChatMessage) => void;
  clearMessages: () => void;
  unreadCount: number;
  resetUnreadCount: () => void;
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesRef = useRef<ChatMessage[]>([]);
  const pendingIdsRef = useRef<Set<string>>(new Set());

  const sendMessage = useCallback(async (
    roomId: string,
    userId: string,
    displayName: string,
    text: string,
  ) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const tempId = `local-${Date.now()}-${Math.random()}`;
    pendingIdsRef.current.add(tempId);

    const optimistic: ChatMessage = {
      id: tempId,
      userId,
      displayName: 'You',
      text: trimmed,
      timestamp: Date.now(),
      type: 'chat',
    };
    messagesRef.current = [...messagesRef.current, optimistic];
    setMessages(messagesRef.current);

    const { data } = await supabase.from('messages').insert({
      room_id: roomId,
      user_id: userId,
      display_name: displayName,
      content: trimmed,
      type: 'chat',
    }).select('id');

    pendingIdsRef.current.delete(tempId);

    if (data && data[0]) {
      messagesRef.current = messagesRef.current.map((m) =>
        m.id === tempId ? { ...m, id: data[0].id.toString() } : m,
      );
      setMessages([...messagesRef.current]);
    }
  }, []);

  const addSystemMessage = useCallback((text: string, type: 'join' | 'leave') => {
    const msg: ChatMessage = {
      id: `sys-${Date.now()}-${Math.random()}`,
      userId: 'system',
      displayName: 'System',
      text,
      timestamp: Date.now(),
      type,
    };
    messagesRef.current = [...messagesRef.current, msg];
    setMessages(messagesRef.current);
  }, []);

  const addRemoteMessage = useCallback((msg: ChatMessage) => {
    const exists = messagesRef.current.some(
      (m) => m.id === msg.id || m.userId === msg.userId && m.text === msg.text &&
        Math.abs(m.timestamp - msg.timestamp) < 2000,
    );
    if (exists) return;
    messagesRef.current = [...messagesRef.current, msg];
    setMessages(messagesRef.current);
    setUnreadCount((prev) => prev + 1);
  }, []);

  const clearMessages = useCallback(() => {
    messagesRef.current = [];
    setMessages([]);
    setUnreadCount(0);
  }, []);

  const resetUnreadCount = useCallback(() => {
    setUnreadCount(0);
  }, []);

  return {
    messages,
    sendMessage,
    addSystemMessage,
    addRemoteMessage,
    clearMessages,
    unreadCount,
    resetUnreadCount,
  };
}
