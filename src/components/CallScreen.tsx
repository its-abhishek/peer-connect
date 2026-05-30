import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { CallStatus, ConnectionQuality } from '../types';
import type { MediaStream } from '../utils/webrtc';

interface CallScreenProps {
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  callStatus: CallStatus;
  connectionQuality: ConnectionQuality;
  roomId: string;
  children: React.ReactNode;
}

function getStatusColor(status: CallStatus): string {
  switch (status) {
    case 'connecting':
      return '#FFD60A';
    case 'connected':
      return '#30D158';
    case 'reconnecting':
      return '#FF9F0A';
    case 'disconnected':
      return '#FF453A';
    default:
      return '#8E8E93';
  }
}

function getStatusText(status: CallStatus): string {
  switch (status) {
    case 'connecting':
      return 'Connecting...';
    case 'connected':
      return 'Connected';
    case 'reconnecting':
      return 'Reconnecting...';
    case 'disconnected':
      return 'Disconnected';
    default:
      return 'Idle';
  }
}

function getQualityColor(quality: ConnectionQuality): string {
  switch (quality) {
    case 'good':
      return '#30D158';
    case 'poor':
      return '#FF9F0A';
    case 'disconnected':
      return '#FF453A';
  }
}

export default function CallScreen({
  callStatus,
  connectionQuality,
  roomId,
  children,
}: CallScreenProps) {
  const statusColor = getStatusColor(callStatus);
  const statusText = getStatusText(callStatus);
  const qualityColor = getQualityColor(connectionQuality);

  return (
    <View style={styles.container}>
      <View style={styles.callInfo}>
        <View style={styles.roomBadge}>
          <Text style={styles.roomLabel}>Room</Text>
          <Text style={styles.roomId}>{roomId}</Text>
        </View>

        <View style={styles.statusContainer}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
        </View>

        {callStatus === 'connected' && (
          <View style={styles.qualityContainer}>
            <View style={[styles.qualityDot, { backgroundColor: qualityColor }]} />
            <Text style={[styles.qualityText, { color: qualityColor }]}>
              {connectionQuality === 'good' ? 'Good Connection' : 'Poor Connection'}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.streamsContainer}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1C1E',
  },
  callInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#2C2C2E',
    borderBottomWidth: 1,
    borderBottomColor: '#3A3A3C',
  },
  roomBadge: {
    alignItems: 'flex-start',
  },
  roomLabel: {
    fontSize: 12,
    color: '#8E8E93',
  },
  roomId: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  qualityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  qualityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  qualityText: {
    fontSize: 13,
    fontWeight: '600',
  },
  streamsContainer: {
    flex: 1,
  },
});
