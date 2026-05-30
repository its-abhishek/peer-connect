import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import VideoRenderer from './components/VideoRenderer';
import RoomLobby from './components/RoomLobby';
import CallScreen from './components/CallScreen';
import Controls from './components/Controls';
import ChatPanel from './components/ChatPanel';
import UserList from './components/UserList';
import AuthScreen from './components/AuthScreen';
import { useSignaling } from './hooks/useSignaling';
import { useWebRTC } from './hooks/useWebRTC';
import { useChat } from './hooks/useChat';
import { useAuth } from './hooks/useAuth';
import { supabase } from './utils/supabase';
import type { User, ServerEvent, ChatMessage, Profile } from './types';

export default function App() {
  const { session, loading: authLoading, error: authError, signUp, signIn, signOut } = useAuth();

  const [screen, setScreen] = useState<'auth' | 'lobby' | 'call'>('auth');
  const [roomId, setRoomId] = useState('');
  const [userId, setUserId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [showUserList, setShowUserList] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  const userIdRef = useRef('');
  const roomIdRef = useRef('');
  const usersRef = useRef<User[]>([]);
  const profileRef = useRef<Profile | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (session?.user) {
      setScreen('lobby');
      setUserId(session.user.id);
      userIdRef.current = session.user.id;
      loadProfile(session.user.id);
    } else {
      setScreen('auth');
    }
  }, [session, authLoading]);

  const loadProfile = async (uid: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .single();
    if (data) {
      setProfile(data);
      profileRef.current = data;
      setDisplayName(data.display_name);
    } else {
      // Profile doesn't exist yet, create it from auth user
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const displayName = user.user_metadata?.display_name || user.email?.split('@')[0] || 'User';
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: uid,
            display_name: displayName,
          });
        if (!insertError) {
          setProfile({ id: uid, display_name: displayName, avatar_url: null, created_at: new Date().toISOString() });
          profileRef.current = { id: uid, display_name: displayName, avatar_url: null, created_at: new Date().toISOString() };
          setDisplayName(displayName);
        }
      }
    }
  };

  const handleServerEvent = useCallback((event: ServerEvent) => {
    console.log('[ServerEvent]', event.type, event.payload);
    switch (event.type) {
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
          const exists = prev.some((u) => u.id === newUser.id);
          if (exists) return prev;
          const next = [...prev, newUser];
          usersRef.current = next;
          console.log('[Users Updated]', next.length, 'users in room');
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
          console.log('[User Left]', next.length, 'users remaining');
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
        console.log('[Offer received]', 'from', payload.senderId);
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
        console.log('[Answer received]', 'from', payload.senderId);
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
      case 'error': {
        const errorPayload = event.payload as { message: string };
        setServerError(errorPayload.message);
        setIsConnecting(false);
        break;
      }
    }
  }, []);

  const {
    connect: connectSignaling,
    disconnect: disconnectSignaling,
    send: sendSignaling,
    isConnected: signalingConnected,
    error: signalingError,
  } = useSignaling({
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

  const generateRoomId = useCallback((): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }, []);

  const handleCreateRoom = useCallback(async (name: string) => {
    setServerError(null);
    setIsConnecting(true);
    setDisplayName(name);

    try {
      // Ensure profile exists before creating room
      if (!profileRef.current) {
        await loadProfile(userIdRef.current);
      }

      const newRoomId = generateRoomId();

      // Create room first
      const { error: roomError } = await supabase.from('rooms').insert({
        id: newRoomId,
        name: `${name}'s Room`,
        created_by: userIdRef.current,
      });

      if (roomError) {
        setServerError(`Failed to create room: ${roomError.message}`);
        setIsConnecting(false);
        return;
      }

      // Add creator as participant
      const { error: joinError } = await supabase.from('room_participants').insert({
        room_id: newRoomId,
        user_id: userIdRef.current,
      });

      if (joinError) {
        setServerError(`Failed to join room: ${joinError.message}`);
        setIsConnecting(false);
        return;
      }

      // Connect signaling
      setRoomId(newRoomId);
      roomIdRef.current = newRoomId;
      setScreen('call');

      try {
        await connectSignaling(newRoomId);
      } catch (signalingError) {
        setServerError(`Signaling connection failed: ${signalingError instanceof Error ? signalingError.message : 'Unknown error'}`);
        setIsConnecting(false);
        setScreen('lobby');
        roomIdRef.current = '';
        setRoomId('');
        return;
      }

      setIsConnecting(false);

      // Start call after everything is ready
      await new Promise((resolve) => setTimeout(resolve, 300));
      startCall([]);
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : 'Failed to create room'
      );
      setIsConnecting(false);
    }
  }, [connectSignaling, startCall, generateRoomId]);

  const handleJoinRoom = useCallback(async (room: string, name: string) => {
    setServerError(null);
    setIsConnecting(true);
    setDisplayName(name);

    try {
      // Check if room exists and is active
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', room)
        .eq('is_active', true)
        .single();

      if (roomError || !roomData) {
        setServerError('Room not found or is inactive');
        setIsConnecting(false);
        return;
      }

      // Check room capacity
      const { data: participants, error: countError } = await supabase
        .from('room_participants')
        .select('*')
        .eq('room_id', room)
        .is('left_at', null);

      if (!countError && participants && participants.length >= 10) {
        setServerError('Room is full (max 10 participants)');
        setIsConnecting(false);
        return;
      }

      // Try to add as participant
      const { error: joinError } = await supabase.from('room_participants').insert({
        room_id: room,
        user_id: userIdRef.current,
      });

      if (joinError) {
        if (joinError.message.includes('duplicate')) {
          // User already in room, clear left_at
          const { error: updateError } = await supabase
            .from('room_participants')
            .update({ left_at: null })
            .eq('room_id', room)
            .eq('user_id', userIdRef.current);

          if (updateError) {
            setServerError(`Failed to rejoin: ${updateError.message}`);
            setIsConnecting(false);
            return;
          }
        } else {
          setServerError(`Failed to join: ${joinError.message}`);
          setIsConnecting(false);
          return;
        }
      }

      // Get existing participants
      const { data: existingUsers } = await supabase
        .from('room_participants')
        .select('user_id, profiles:user_id(display_name)')
        .eq('room_id', room)
        .is('left_at', null);

      const participantList: User[] = (existingUsers || [])
        .filter((p: any) => p.user_id !== userIdRef.current)
        .map((p: any) => ({
          id: p.user_id,
          peerId: p.user_id,
          displayName: (p.profiles as any)?.display_name || 'Unknown',
          isAudioEnabled: true,
          isVideoEnabled: false,
          isSpeaking: false,
          joinTimestamp: Date.now(),
        }));

      // Set room info
      setUsers(participantList);
      usersRef.current = participantList;
      setRoomId(room);
      roomIdRef.current = room;

      // Connect signaling
      try {
        await connectSignaling(room);
      } catch (signalingError) {
        setServerError(`Signaling connection failed: ${signalingError instanceof Error ? signalingError.message : 'Unknown error'}`);
        setIsConnecting(false);
        setScreen('lobby');
        roomIdRef.current = '';
        setRoomId('');
        return;
      }

      setScreen('call');
      setIsConnecting(false);

      // Start call after screen transition
      await new Promise((resolve) => setTimeout(resolve, 300));
      startCall(participantList);
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : 'Failed to join room'
      );
      setIsConnecting(false);
    }
  }, [connectSignaling, startCall]);

  const handleEndCall = useCallback(async () => {
    const uid = userIdRef.current;
    const rid = roomIdRef.current;

    if (uid && rid) {
      await supabase
        .from('room_participants')
        .update({ left_at: new Date().toISOString() })
        .eq('room_id', rid)
        .eq('user_id', uid);
    }

    endWebRTCCall();
    disconnectSignaling();
    setScreen('lobby');
    setRoomId('');
    roomIdRef.current = '';
    setUsers([]);
    usersRef.current = [];
    setShowChat(false);
    setShowUserList(false);
  }, [endWebRTCCall, disconnectSignaling]);

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

  const handleSendChat = useCallback((text: string) => {
    sendChatMessage(roomIdRef.current, userIdRef.current, displayName, text);
    setUsers((prev) => prev.map((u) => u.id === userIdRef.current ? { ...u, isAudioEnabled: u.isAudioEnabled } : u));
  }, [sendChatMessage, displayName]);

  const handleToggleMute = useCallback(() => {
    toggleMute();
    sendSignaling({
      type: 'user-muted',
      senderId: userIdRef.current,
      roomId: roomIdRef.current,
      payload: { userId: userIdRef.current, isAudioEnabled: !isAudioEnabled },
    });
  }, [toggleMute, sendSignaling, isAudioEnabled]);

  const handleToggleVideo = useCallback(() => {
    toggleVideo();
    sendSignaling({
      type: 'user-video-toggled',
      senderId: userIdRef.current,
      roomId: roomIdRef.current,
      payload: { userId: userIdRef.current, isVideoEnabled: !isVideoEnabled },
    });
  }, [toggleVideo, sendSignaling, isVideoEnabled]);

  const remoteStreamsArray = useMemo(
    () => Array.from(remoteStreams.entries()),
    [remoteStreams],
  );

  if (authLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0A84FF" />
        </View>
      </SafeAreaView>
    );
  }

  if (screen === 'auth') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <AuthScreen
          onSignIn={signIn}
          onSignUp={signUp}
          loading={authLoading}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {screen === 'lobby' && (
        <RoomLobby
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          isConnecting={isConnecting}
          error={serverError}
          displayName={displayName}
          onSignOut={signOut}
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
                    onSendMessage={handleSendChat}
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
              onToggleMute={handleToggleMute}
              onToggleVideo={handleToggleVideo}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
