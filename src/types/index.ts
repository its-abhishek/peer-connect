export interface User {
  id: string;
  peerId: string;
  displayName: string;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isSpeaking: boolean;
  joinTimestamp: number;
}

export interface ChatMessage {
  id: string;
  userId: string;
  displayName: string;
  text: string;
  timestamp: number;
  type: 'chat' | 'join' | 'leave';
}

export type CallStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

export type ConnectionQuality = 'good' | 'poor' | 'disconnected';

export type MediaType = 'voice' | 'video';

export interface RoomInfo {
  id: string;
  users: User[];
  createdAt: number;
}

export interface SignalingMessage {
  type: string;
  senderId: string;
  targetId?: string;
  roomId?: string;
  payload?: unknown;
}

export interface SdpPayload {
  sdp: string;
  type: RTCSdpType;
}

export interface IceCandidatePayload {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
}

export interface ServerEvent {
  type:
    | 'room-created'
    | 'room-joined'
    | 'user-joined'
    | 'user-left'
    | 'offer'
    | 'answer'
    | 'ice-candidate'
    | 'chat-message'
    | 'user-muted'
    | 'user-video-toggled'
    | 'user-list'
    | 'room-not-found'
    | 'room-full'
    | 'username-taken'
    | 'error';
  payload?: unknown;
}

export interface CreateRoomResponse {
  roomId: string;
  userId: string;
  users: User[];
}

export interface JoinRoomResponse {
  roomId: string;
  userId: string;
  users: User[];
}

export interface SignalingConfig {
  serverUrl: string;
  roomId?: string;
  displayName: string;
}
