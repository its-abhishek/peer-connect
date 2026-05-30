import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';

interface RoomLobbyProps {
  onCreateRoom: (displayName: string) => void;
  onJoinRoom: (roomId: string, displayName: string) => void;
  isConnecting: boolean;
  error: string | null;
  displayName: string;
  onSignOut: () => void;
}

export default function RoomLobby({
  onCreateRoom,
  onJoinRoom,
  isConnecting,
  error,
  displayName,
  onSignOut,
}: RoomLobbyProps) {
  const [roomId, setRoomId] = useState('');
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');

  const handleCreate = useCallback(() => {
    onCreateRoom(displayName);
  }, [displayName, onCreateRoom]);

  const handleJoin = useCallback(() => {
    const room = roomId.trim().toUpperCase();
    if (!room) {
      Alert.alert('Required', 'Please enter a room ID');
      return;
    }
    onJoinRoom(room, displayName);
  }, [displayName, roomId, onJoinRoom]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.logo}>PeerConnect</Text>
          <TouchableOpacity style={styles.signOutButton} onPress={onSignOut}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>Welcome, {displayName}</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'create' && styles.activeTab]}
            onPress={() => setActiveTab('create')}
          >
            <Text style={[styles.tabText, activeTab === 'create' && styles.activeTabText]}>
              Create Room
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'join' && styles.activeTab]}
            onPress={() => setActiveTab('join')}
          >
            <Text style={[styles.tabText, activeTab === 'join' && styles.activeTabText]}>
              Join Room
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'join' && (
          <TextInput
            style={styles.input}
            placeholder="Enter Room ID (e.g. ABC123)"
            placeholderTextColor="#8E8E93"
            value={roomId}
            onChangeText={(t) => setRoomId(t.toUpperCase())}
            autoCapitalize="characters"
            maxLength={8}
          />
        )}

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.button, isConnecting && styles.buttonDisabled]}
          onPress={activeTab === 'create' ? handleCreate : handleJoin}
          disabled={isConnecting}
        >
          {isConnecting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>
              {activeTab === 'create' ? 'Create Room' : 'Join Room'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.info}>
        <Text style={styles.infoText}>
          Rooms are persistent. Share the 8-character room ID to invite others.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1C1E',
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    marginBottom: 48,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  logo: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  signOutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#3A3A3C',
  },
  signOutText: {
    color: '#FF453A',
    fontSize: 14,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
  },
  form: {
    backgroundColor: '#2C2C2E',
    borderRadius: 16,
    padding: 24,
    gap: 16,
  },
  input: {
    backgroundColor: '#3A3A3C',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#48484A',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#3A3A3C',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  activeTab: {
    backgroundColor: '#0A84FF',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  button: {
    backgroundColor: '#0A84FF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  errorContainer: {
    backgroundColor: '#3A1212',
    borderRadius: 8,
    padding: 12,
  },
  errorText: {
    color: '#FF453A',
    fontSize: 14,
    textAlign: 'center',
  },
  info: {
    alignItems: 'center',
    marginTop: 24,
  },
  infoText: {
    color: '#8E8E93',
    fontSize: 12,
    textAlign: 'center',
  },
});
