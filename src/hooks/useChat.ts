import { useState, useCallback, useRef } from 'react';
import type { ChatMessage } from '../types';

let idCounter = 0;
function generateId(): string {
  return `${Date.now()}-${++idCounter}`;
}

interface UseChatReturn {
  messages: ChatMessage[];
  sendMessage: (text: string) => void;
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

  const sendMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const msg: ChatMessage = {
      id: generateId(),
      userId: 'local',
      displayName: 'You',
      text: trimmed,
      timestamp: Date.now(),
      type: 'chat',
    };

    messagesRef.current = [...messagesRef.current, msg];
    setMessages(messagesRef.current);
  }, []);

  const addSystemMessage = useCallback((text: string, type: 'join' | 'leave') => {
    const msg: ChatMessage = {
      id: generateId(),
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
