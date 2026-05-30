import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import type { ChatMessage } from '../types';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onClose: () => void;
}

export default function ChatPanel({ messages, onSendMessage, onClose }: ChatPanelProps) {
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const handleSend = () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setInputText('');
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isSystem = item.type === 'join' || item.type === 'leave';
    const isLocal = item.userId === 'local';

    if (isSystem) {
      return (
        <View style={styles.systemMessage}>
          <Text style={styles.systemText}>{item.text}</Text>
        </View>
      );
    }

    return (
      <View style={[styles.messageBubble, isLocal && styles.localBubble]}>
        {!isLocal && (
          <Text style={styles.senderName}>{item.displayName}</Text>
        )}
        <Text style={[styles.messageText, isLocal && styles.localMessageText]}>
          {item.text}
        </Text>
        <Text style={[styles.timestamp, isLocal && styles.localTimestamp]}>
          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Chat</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      {messages.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No messages yet.</Text>
          <Text style={styles.emptySubtext}>Say hello to the room!</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
        />
      )}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor="#8E8E93"
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          maxLength={500}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim()}
        >
          <Text style={styles.sendText}>→</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1C1E',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#2C2C2E',
    borderBottomWidth: 1,
    borderBottomColor: '#3A3A3C',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3A3A3C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#8E8E93',
    fontSize: 16,
  },
  emptySubtext: {
    color: '#636366',
    fontSize: 14,
    marginTop: 4,
  },
  messageList: {
    padding: 16,
    gap: 8,
  },
  messageBubble: {
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    padding: 12,
    maxWidth: '80%',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  localBubble: {
    backgroundColor: '#0A84FF',
    alignSelf: 'flex-end',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 4,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0A84FF',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    color: '#FFFFFF',
    lineHeight: 20,
  },
  localMessageText: {
    color: '#FFFFFF',
  },
  timestamp: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  localTimestamp: {
    color: '#B0D4FF',
  },
  systemMessage: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  systemText: {
    fontSize: 12,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#2C2C2E',
    borderTopWidth: 1,
    borderTopColor: '#3A3A3C',
    gap: 8,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#3A3A3C',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#FFFFFF',
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0A84FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#3A3A3C',
  },
  sendText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});
