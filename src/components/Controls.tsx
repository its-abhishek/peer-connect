import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import type { MediaType } from '../types';

interface ControlsProps {
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  mediaType: MediaType;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onSwitchCamera: () => void;
  onToggleScreenShare: () => void;
  onEndCall: () => void;
  onToggleSpeaker: () => void;
  onToggleChat: () => void;
  isSpeakerOn: boolean;
  hasUnreadChat: boolean;
}

export default function Controls({
  isAudioEnabled,
  isVideoEnabled,
  isScreenSharing,
  mediaType,
  onToggleMute,
  onToggleVideo,
  onSwitchCamera,
  onToggleScreenShare,
  onEndCall,
  onToggleSpeaker,
  onToggleChat,
  isSpeakerOn,
  hasUnreadChat,
}: ControlsProps) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <ControlButton
          icon={isAudioEnabled ? '🎤' : '🔇'}
          label={isAudioEnabled ? 'Mute' : 'Unmute'}
          active={isAudioEnabled}
          onPress={onToggleMute}
        />
        <ControlButton
          icon={isVideoEnabled ? '📷' : '🚫'}
          label={isVideoEnabled ? 'Video On' : 'Video Off'}
          active={isVideoEnabled}
          onPress={onToggleVideo}
        />
        {isVideoEnabled && (
          <ControlButton
            icon="🔄"
            label="Flip"
            active
            onPress={onSwitchCamera}
          />
        )}
        <ControlButton
          icon={isSpeakerOn ? '🔊' : '🦻'}
          label={isSpeakerOn ? 'Speaker' : 'Earpiece'}
          active={isSpeakerOn}
          onPress={onToggleSpeaker}
        />
      </View>

      <View style={styles.row}>
        <ControlButton
          icon={isScreenSharing ? '🖥️' : '📱'}
          label={isScreenSharing ? 'Stop Share' : 'Share Screen'}
          active={isScreenSharing}
          onPress={onToggleScreenShare}
        />
        <ControlButton
          icon="💬"
          label="Chat"
          active
          badge={hasUnreadChat}
          onPress={onToggleChat}
        />
      </View>

      <TouchableOpacity style={styles.endCallButton} onPress={onEndCall}>
        <Text style={styles.endCallText}>📞</Text>
        <Text style={styles.endCallLabel}>End Call</Text>
      </TouchableOpacity>
    </View>
  );
}

interface ControlButtonProps {
  icon: string;
  label: string;
  active: boolean;
  onPress: () => void;
  badge?: boolean;
}

function ControlButton({ icon, label, active, onPress, badge }: ControlButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.controlButton, !active && styles.controlButtonInactive]}
      onPress={onPress}
    >
      <View>
        <Text style={styles.controlIcon}>{icon}</Text>
        {badge && <View style={styles.badge} />}
      </View>
      <Text style={[styles.controlLabel, !active && styles.controlLabelInactive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#2C2C2E',
    borderTopWidth: 1,
    borderTopColor: '#3A3A3C',
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  controlButton: {
    backgroundColor: '#3A3A3C',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    minWidth: 64,
    gap: 4,
  },
  controlButtonInactive: {
    backgroundColor: '#48484A',
    opacity: 0.7,
  },
  controlIcon: {
    fontSize: 22,
  },
  controlLabel: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  controlLabelInactive: {
    color: '#8E8E93',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF453A',
    borderWidth: 1.5,
    borderColor: '#2C2C2E',
  },
  endCallButton: {
    backgroundColor: '#FF453A',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  endCallText: {
    fontSize: 18,
  },
  endCallLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
