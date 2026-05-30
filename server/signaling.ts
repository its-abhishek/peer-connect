import { WebSocket, RawData } from 'ws';
import {
  createRoom,
  joinRoom,
  leaveRoom,
  getRoomByUserId,
  broadcastToRoom,
  sendToUser,
  getUserInRoom,
  setUserAudioEnabled,
  setUserVideoEnabled,
} from './rooms';

interface ParsedMessage {
  type: string;
  targetId?: string;
  roomId?: string;
  senderId?: string;
  displayName?: string;
  payload?: unknown;
}

export function handleMessage(ws: WebSocket, rawData: RawData): void {
  let parsed: ParsedMessage;
  try {
    parsed = JSON.parse(rawData.toString());
  } catch {
    sendError(ws, 'Invalid JSON');
    return;
  }

  switch (parsed.type) {
    case 'create-room':
      handleCreateRoom(ws, parsed);
      break;
    case 'join-room':
      handleJoinRoom(ws, parsed);
      break;
    case 'leave-room':
      handleLeaveRoom(ws, parsed);
      break;
    case 'offer':
      handleOffer(ws, parsed);
      break;
    case 'answer':
      handleAnswer(ws, parsed);
      break;
    case 'ice-candidate':
      handleIceCandidate(ws, parsed);
      break;
    case 'chat-message':
      handleChatMessage(ws, parsed);
      break;
    case 'toggle-audio':
      handleToggleAudio(ws, parsed);
      break;
    case 'toggle-video':
      handleToggleVideo(ws, parsed);
      break;
    default:
      sendError(ws, `Unknown message type: ${parsed.type}`);
  }
}

function handleCreateRoom(ws: WebSocket, msg: ParsedMessage): void {
  const displayName = (msg.payload as { displayName?: string })?.displayName || 'Anonymous';
  const { roomId, userId } = createRoom(ws, displayName);

  sendToUser(userId, {
    type: 'room-created',
    payload: { roomId, userId },
  });
}

function handleJoinRoom(ws: WebSocket, msg: ParsedMessage): void {
  const { roomId, displayName } = msg.payload as {
    roomId?: string;
    displayName?: string;
  };

  if (!roomId) {
    sendError(ws, 'Room ID is required');
    return;
  }

  const name = displayName || 'Anonymous';
  const result = joinRoom(ws, roomId, name);

  if ('error' in result) {
    sendError(ws, result.error);
    return;
  }

  sendToUser(result.userId, {
    type: 'room-joined',
    payload: {
      roomId: result.roomId,
      userId: result.userId,
      users: result.users.map((u) => ({
        id: u.id,
        displayName: u.displayName,
        isAudioEnabled: u.isAudioEnabled,
        isVideoEnabled: u.isVideoEnabled,
        isSpeaking: u.isSpeaking,
        joinTimestamp: u.joinTimestamp,
      })),
    },
  });

  broadcastToRoom(result.roomId, result.userId, {
    type: 'user-joined',
    payload: {
      userId: result.userId,
      displayName: name,
    },
  });
}

function handleLeaveRoom(ws: WebSocket, msg: ParsedMessage): void {
  const senderId = msg.senderId;
  if (!senderId) {
    sendError(ws, 'Sender ID required');
    return;
  }

  const { roomId, otherUserIds } = leaveRoom(senderId);

  if (roomId) {
    broadcastToRoom(roomId, senderId, {
      type: 'user-left',
      payload: { userId: senderId },
    });
  }
}

function handleOffer(ws: WebSocket, msg: ParsedMessage): void {
  const { targetId, senderId, payload } = msg;
  if (!targetId || !senderId) {
    sendError(ws, 'targetId and senderId required for offer');
    return;
  }

  sendToUser(targetId, {
    type: 'offer',
    payload: { senderId, ...(payload as object) },
  });
}

function handleAnswer(ws: WebSocket, msg: ParsedMessage): void {
  const { targetId, senderId, payload } = msg;
  if (!targetId || !senderId) {
    sendError(ws, 'targetId and senderId required for answer');
    return;
  }

  sendToUser(targetId, {
    type: 'answer',
    payload: { senderId, ...(payload as object) },
  });
}

function handleIceCandidate(ws: WebSocket, msg: ParsedMessage): void {
  const { targetId, senderId, payload } = msg;
  if (!targetId || !senderId) {
    sendError(ws, 'targetId and senderId required for ICE candidate');
    return;
  }

  sendToUser(targetId, {
    type: 'ice-candidate',
    payload: { senderId, ...(payload as object) },
  });
}

function handleChatMessage(ws: WebSocket, msg: ParsedMessage): void {
  const { senderId, roomId, payload } = msg;
  if (!roomId || !senderId) {
    sendError(ws, 'roomId and senderId required for chat');
    return;
  }

  const user = getUserInRoom(roomId, senderId);
  if (!user) {
    sendError(ws, 'User not found in room');
    return;
  }

  broadcastToRoom(roomId, null, {
    type: 'chat-message',
    payload: {
      id: (payload as { id?: string })?.id || '',
      userId: senderId,
      displayName: user.displayName,
      text: (payload as { text?: string })?.text || '',
      timestamp: Date.now(),
      type: 'chat',
    },
  });
}

function handleToggleAudio(ws: WebSocket, msg: ParsedMessage): void {
  const { senderId, roomId, payload } = msg;
  if (!roomId || !senderId) return;

  const enabled = (payload as { enabled?: boolean })?.enabled ?? true;
  setUserAudioEnabled(senderId, enabled);

  broadcastToRoom(roomId, senderId, {
    type: 'user-muted',
    payload: { userId: senderId, isAudioEnabled: enabled },
  });
}

function handleToggleVideo(ws: WebSocket, msg: ParsedMessage): void {
  const { senderId, roomId, payload } = msg;
  if (!roomId || !senderId) return;

  const enabled = (payload as { enabled?: boolean })?.enabled ?? false;
  setUserVideoEnabled(senderId, enabled);

  broadcastToRoom(roomId, senderId, {
    type: 'user-video-toggled',
    payload: { userId: senderId, isVideoEnabled: enabled },
  });
}

function sendError(ws: WebSocket, message: string): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify({ type: 'error', payload: { message } }));
  }
}
