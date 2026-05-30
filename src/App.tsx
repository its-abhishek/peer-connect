import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Dimensions,
} from 'react-native';
import VideoRenderer from './components/VideoRenderer';
import RoomLobby from './components/RoomLobby';
import CallScreen from './components/CallScreen';
import Controls from './components/Controls';
import ChatPanel from './components/ChatPanel';
import UserList from './components/UserList';
import { useSignaling } from './hooks/useSignaling';
import { useWebRTC } from './hooks/useWebRTC';
import { useChat } from './hooks/useChat';
import type { User, ServerEvent, ChatMessage } from './types';

const SIGNALING_SERVER = process.env.EXPO_PUBLIC_SIGNALING_SERVER || 'ws://localhost:8080';

export default function App() {
  const [screen, setScreen] = useState<'lobby' | 'call'>('lobby');
  const [roomId, setRoomId] = useState('');
  const [userId, setUserId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [showUserList, setShowUserList] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);

  const userIdRef = useRef('');
  const roomIdRef = useRef('');
  const usersRef = useRef<User[]>([]);

  const handleServerEvent = useCallback((event: ServerEvent) => {
    switch (event.type) {
      case 'room-created': {
        const payload = event.payload as { roomId: string; userId: string };
        setRoomId(payload.roomId);
        roomIdRef.current = payload.roomId;
        setUserId(payload.userId);
        userIdRef.current = payload.userId;
        setScreen('call');
        setServerError(null);
        setIsConnecting(false);
        setTimeout(() => startCall([]), 500);
        break;
      }
      case 'room-joined': {
        const payload = event.payload as {
          roomId: string;
          userId: string;
          users: User[];
        };
        setRoomId(payload.roomId);
        roomIdRef.current = payload.roomId;
        setUserId(payload.userId);
        userIdRef.current = payload.userId;
        setUsers(payload.users || []);
        usersRef.current = payload.users || [];
        setScreen('call');
        setServerError(null);
        setIsConnecting(false);
        setTimeout(() => startCall(payload.users || []), 500);
        break;
      }
      case 'user-joined': {
        const payload = event.payload as { userId: string; displayName: string };
        const newUser: User = {
          id: payload.userId,
          peerId: payload.userId,
          displayName: payload.displayName,
          isAudioEnabled: true,
          isVideoEnabled: false,
          isSpeaking: false,
          joinTimestamp: Date.now(),
        };
        setUsers((prev) => {
          const next = [...prev, newUser];
          usersRef.current = next;
          return next;
        });
        connectToUser(payload.userId, payload.displayName);
        break;
      }
      case 'user-left': {
        const payload = event.payload as { userId: string };
        setUsers((prev) => {
          const next = prev.filter((u) => u.id !== payload.userId);
          usersRef.current = next;
          return next;
        });
        handleUserLeft(payload.userId);
        break;
      }
      case 'offer': {
        const payload = event.payload as {
          senderId: string;
          sdp: string;
          type: RTCSdpType;
        };
        handleOffer(payload.senderId, {
          sdp: payload.sdp,
          type: payload.type,
        });
        break;
      }
      case 'answer': {
        const payload = event.payload as {
          senderId: string;
          sdp: string;
          type: RTCSdpType;
        };
        handleAnswer(payload.senderId, {
          sdp: payload.sdp,
          type: payload.type,
        });
        break;
      }
      case 'ice-candidate': {
        const payload = event.payload as {
          senderId: string;
          candidate: string;
          sdpMid: string | null;
          sdpMLineIndex: number | null;
        };
        handleIceCandidate(payload.senderId, {
          candidate: payload.candidate,
          sdpMid: payload.sdpMid,
          sdpMLineIndex: payload.sdpMLineIndex,
        });
        break;
      }
      case 'chat-message': {
        const msg = event.payload as ChatMessage;
        addRemoteMessage(msg);
        break;
      }
      case 'user-muted': {
        const mutePayload = event.payload as {
          userId: string;
          isAudioEnabled: boolean;
        };
        setUsers((prev) =>
          prev.map((u) =>
            u.id === mutePayload.userId
              ? { ...u, isAudioEnabled: mutePayload.isAudioEnabled }
              : u,
          ),
        );
        break;
      }
      case 'user-video-toggled': {
        const videoPayload = event.payload as {
          userId: string;
          isVideoEnabled: boolean;
        };
        setUsers((prev) =>
          prev.map((u) =>
            u.id === videoPayload.userId
              ? { ...u, isVideoEnabled: videoPayload.isVideoEnabled }
              : u,
          ),
        );
        break;
      }
      case 'room-not-found': {
        setServerError('Room not found');
        setIsConnecting(false);
        break;
      }
      case 'room-full': {
        setServerError('Room is full');
        setIsConnecting(false);
        break;
      }
      case 'username-taken': {
        setServerError('Username already taken');
        setIsConnecting(false);
        break;
      }
      case 'error': {
        const errorPayload = event.payload as { message: string };
        setServerError(errorPayload.message);
        setIsConnecting(false);
        break;
      }
    }
  }, []);

  const {
    connect,
    disconnect,
    send: sendSignaling,
    isConnected,
    error: signalingError,
  } = useSignaling({
    serverUrl: SIGNALING_SERVER,
    onMessage: handleServerEvent,
  });

  const sendSignalingRef = useRef(sendSignaling);
  sendSignalingRef.current = sendSignaling;

  const webrtcSendSignaling = useCallback((msg: object) => {
    const enriched = roomIdRef.current
      ? { ...msg, roomId: roomIdRef.current }
      : msg;
    sendSignalingRef.current(enriched);
  }, []);

  const {
    localStream,
    remoteStreams,
    callStatus,
    connectionQuality,
    isAudioEnabled,
    isVideoEnabled,
    isScreenSharing,
    mediaType,
    speakingUsers,
    startCall,
    endCall: endWebRTCCall,
    toggleMute,
    toggleVideo,
    switchCamera,
    toggleScreenShare,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    handleUserLeft,
    connectToUser,
  } = useWebRTC({
    userId: userIdRef.current,
    sendSignalingMessage: webrtcSendSignaling,
  });

  const {
    messages: chatMessages,
    sendMessage: sendChatMessage,
    addSystemMessage,
    addRemoteMessage,
    unreadCount,
    resetUnreadCount,
  } = useChat();

  useEffect(() => {
    if (signalingError) {
      setServerError(signalingError);
    }
  }, [signalingError]);

  const handleCreateRoom = useCallback((name: string) => {
    setDisplayName(name);
    setServerError(null);
    setIsConnecting(true);
    connect('pending');

    setTimeout(() => {
      sendSignaling({
        type: 'create-room',
        senderId: 'pending',
        payload: { displayName: name },
      });
    }, 500);
  }, [connect, sendSignaling]);

  const handleJoinRoom = useCallback((room: string, name: string) => {
    setDisplayName(name);
    setServerError(null);
    setIsConnecting(true);
    connect('pending');

    setTimeout(() => {
      sendSignaling({
        type: 'join-room',
        senderId: 'pending',
        payload: { roomId: room, displayName: name },
      });
    }, 500);
  }, [connect, sendSignaling]);

  const handleEndCall = useCallback(() => {
    const uid = userIdRef.current;
    const rid = roomIdRef.current;
    if (uid && rid) {
      sendSignaling({
        type: 'leave-room',
        senderId: uid,
        roomId: rid,
      });
    }
    endWebRTCCall();
    disconnect();
    setScreen('lobby');
    setRoomId('');
    roomIdRef.current = '';
    setUserId('');
    userIdRef.current = '';
    setUsers([]);
    usersRef.current = [];
    setShowChat(false);
    setShowUserList(false);
  }, [sendSignaling, endWebRTCCall, disconnect]);

  const handleToggleChat = useCallback(() => {
    setShowChat((prev) => !prev);
    setShowUserList(false);
    if (!showChat) {
      resetUnreadCount();
    }
  }, [showChat, resetUnreadCount]);

  const handleToggleUserList = useCallback(() => {
    setShowUserList((prev) => !prev);
    setShowChat(false);
  }, []);

  const handleToggleSpeaker = useCallback(() => {
    setIsSpeakerOn((prev) => !prev);
  }, []);

  const remoteStreamsArray = useMemo(
    () => Array.from(remoteStreams.entries()),
    [remoteStreams],
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {screen === 'lobby' && (
        <RoomLobby
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          isConnecting={isConnecting}
          error={serverError}
        />
      )}

      {screen === 'call' && (
        <View style={styles.callContainer}>
          <CallScreen
            localStream={localStream}
            remoteStreams={remoteStreams}
            callStatus={callStatus}
            connectionQuality={connectionQuality}
            roomId={roomId}
          >
            <View style={styles.streamsContainer}>
              {remoteStreamsArray.length > 0 ? (
                <ScrollView style={styles.remoteStreams}>
                  {remoteStreamsArray.map(([peerId, stream]) => (
                    <VideoRenderer
                      key={peerId}
                      stream={stream}
                      style={styles.remoteVideo}
                      objectFit="cover"
                    />
                  ))}
                </ScrollView>
              ) : (
                <View style={styles.waitingContainer}>
                  <Text style={styles.waitingText}>
                    {callStatus === 'connected' ? 'Waiting for others...' : 'Connecting...'}
                  </Text>
                </View>
              )}

              {localStream && mediaType === 'video' && (
                <VideoRenderer
                  stream={localStream}
                  style={styles.localVideo}
                  objectFit="cover"
                  mirror={true}
                  muted
                />
              )}
            </View>
          </CallScreen>

          <View style={styles.bottomPanel}>
            {(showChat || showUserList) && (
              <View style={styles.overlay}>
                {showChat && (
                  <ChatPanel
                    messages={chatMessages}
                    onSendMessage={(text) => {
                      sendChatMessage(text);
                      if (text.trim()) {
                        sendSignaling({
                          type: 'chat-message',
                          senderId: userIdRef.current,
                          roomId: roomIdRef.current,
                          payload: { text: text.trim(), id: Date.now().toString() },
                        });
                      }
                    }}
                    onClose={handleToggleChat}
                  />
                )}
                {showUserList && (
                  <UserList
                    users={users}
                    localUserId={userId}
                    speakingUsers={speakingUsers}
                    mediaType={mediaType}
                  />
                )}
              </View>
            )}

            <Controls
              isAudioEnabled={isAudioEnabled}
              isVideoEnabled={isVideoEnabled}
              isScreenSharing={isScreenSharing}
              mediaType={mediaType}
              onToggleMute={() => {
                toggleMute();
                sendSignaling({
                  type: 'toggle-audio',
                  senderId: userIdRef.current,
                  roomId: roomIdRef.current,
                  payload: { enabled: !isAudioEnabled },
                });
              }}
              onToggleVideo={() => {
                toggleVideo();
              }}
              onSwitchCamera={switchCamera}
              onToggleScreenShare={toggleScreenShare}
              onEndCall={handleEndCall}
              onToggleSpeaker={handleToggleSpeaker}
              onToggleChat={handleToggleChat}
              isSpeakerOn={isSpeakerOn}
              hasUnreadChat={unreadCount > 0}
            />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1C1E',
  },
  callContainer: {
    flex: 1,
  },
  streamsContainer: {
    flex: 1,
    position: 'relative',
  },
  remoteStreams: {
    flex: 1,
  },
  remoteVideo: {
    width: '100%',
    height: 300,
    backgroundColor: '#2C2C2E',
    marginBottom: 2,
  },
  localVideo: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 120,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#2C2C2E',
    borderWidth: 2,
    borderColor: '#0A84FF',
  },
  waitingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  waitingText: {
    fontSize: 18,
    color: '#8E8E93',
  },
  bottomPanel: {
    position: 'relative',
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: Dimensions.get('window').height * 0.4,
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    zIndex: 10,
    elevation: 10,
  },
});
