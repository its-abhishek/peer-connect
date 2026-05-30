import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
} from 'react-native';
import type { User, MediaType } from '../types';

interface UserListProps {
  users: User[];
  localUserId: string;
  speakingUsers: Set<string>;
  mediaType: MediaType;
}

export default function UserList({ users, localUserId, speakingUsers, mediaType }: UserListProps) {
  const renderUser = ({ item }: { item: User }) => {
    const isLocal = item.id === localUserId;
    const isSpeaking = speakingUsers.has(item.id);
    const hasVideo = item.isVideoEnabled && mediaType === 'video';

    return (
      <View style={[styles.userItem, isSpeaking && styles.speakingBorder]}>
        <View style={styles.avatarContainer}>
          <View style={[styles.avatar, isSpeaking && styles.avatarSpeaking]}>
            <Text style={styles.avatarText}>
              {item.displayName.charAt(0).toUpperCase()}
            </Text>
            {hasVideo && (
              <View style={styles.videoIndicator}>
                <Text style={styles.videoIndicatorText}>📷</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.userInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.userName}>
              {item.displayName}
              {isLocal && ' (You)'}
            </Text>
            {isSpeaking && <Text style={styles.speakingIndicator}>🔊</Text>}
          </View>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.microphoneIndicator,
                item.isAudioEnabled ? styles.micOn : styles.micOff,
              ]}
            />
            <Text style={styles.statusText}>
              {item.isAudioEnabled ? 'Unmuted' : 'Muted'}
            </Text>
            {mediaType === 'video' && (
              <Text style={styles.statusDivider}>·</Text>
            )}
            {mediaType === 'video' && (
              <Text style={styles.statusText}>
                {item.isVideoEnabled ? 'Video On' : 'Video Off'}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.joinTime}>
          <Text style={styles.joinTimeText}>
            {new Date(item.joinTimestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          Users ({users.length})
        </Text>
      </View>

      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        renderItem={renderUser}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1C1E',
  },
  header: {
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
  list: {
    padding: 12,
    gap: 8,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: 12,
  },
  speakingBorder: {
    borderColor: '#30D158',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0A84FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSpeaking: {
    backgroundColor: '#30D158',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  videoIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
  },
  videoIndicatorText: {
    fontSize: 12,
  },
  userInfo: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  speakingIndicator: {
    fontSize: 14,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  microphoneIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  micOn: {
    backgroundColor: '#30D158',
  },
  micOff: {
    backgroundColor: '#FF453A',
  },
  statusText: {
    fontSize: 12,
    color: '#8E8E93',
  },
  statusDivider: {
    fontSize: 12,
    color: '#636366',
  },
  joinTime: {
    alignItems: 'flex-end',
  },
  joinTimeText: {
    fontSize: 11,
    color: '#636366',
  },
});
