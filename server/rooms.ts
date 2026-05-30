import { v4 as uuidv4 } from 'uuid';

interface User {
  id: string;
  ws: import('ws').WebSocket;
  displayName: string;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isSpeaking: boolean;
  joinTimestamp: number;
}

interface Room {
  id: string;
  users: Map<string, User>;
  createdAt: number;
}

const rooms = new Map<string, Room>();

function generateRoomId(): string {
  return uuidv4().slice(0, 8).toUpperCase();
}

export function createRoom(ws: import('ws').WebSocket, displayName: string): { roomId: string; userId: string } {
  const roomId = generateRoomId();
  const userId = uuidv4();

  const user: User = {
    id: userId,
    ws,
    displayName,
    isAudioEnabled: true,
    isVideoEnabled: false,
    isSpeaking: false,
    joinTimestamp: Date.now(),
  };

  const room: Room = {
    id: roomId,
    users: new Map([[userId, user]]),
    createdAt: Date.now(),
  };

  rooms.set(roomId, room);
  return { roomId, userId };
}

export function joinRoom(
  ws: import('ws').WebSocket,
  roomId: string,
  displayName: string
): { roomId: string; userId: string; users: Omit<User, 'ws'>[] } | { error: string } {
  const room = rooms.get(roomId);
  if (!room) {
    return { error: 'Room not found' };
  }

  const existingUser = Array.from(room.users.values()).find(
    (u) => u.displayName === displayName
  );
  if (existingUser) {
    return { error: 'Username already taken' };
  }

  const userId = uuidv4();
  const user: User = {
    id: userId,
    ws,
    displayName,
    isAudioEnabled: true,
    isVideoEnabled: false,
    isSpeaking: false,
    joinTimestamp: Date.now(),
  };

  room.users.set(userId, user);

  const otherUsers = Array.from(room.users.values())
    .filter((u) => u.id !== userId)
    .map(({ ws: _ws, ...rest }) => rest);

  return { roomId, userId, users: otherUsers };
}

export function leaveRoom(userId: string): { roomId: string | null; otherUserIds: string[] } {
  for (const [roomId, room] of rooms.entries()) {
    const user = room.users.get(userId);
    if (user) {
      room.users.delete(userId);

      const otherUserIds = Array.from(room.users.keys());

      if (room.users.size === 0) {
        rooms.delete(roomId);
      }

      return { roomId, otherUserIds };
    }
  }
  return { roomId: null, otherUserIds: [] };
}

export function getRoomByUserId(userId: string): Room | null {
  for (const room of rooms.values()) {
    if (room.users.has(userId)) {
      return room;
    }
  }
  return null;
}

export function getRoomUsers(roomId: string): Array<Omit<User, 'ws'>> | null {
  const room = rooms.get(roomId);
  if (!room) return null;

  return Array.from(room.users.values()).map(({ ws: _ws, ...rest }) => rest as Omit<User, 'ws'>);
}

export function getUserInRoom(roomId: string, userId: string): User | null {
  const room = rooms.get(roomId);
  if (!room) return null;
  return room.users.get(userId) || null;
}

export function broadcastToRoom(roomId: string, senderId: string | null, message: object): void {
  const room = rooms.get(roomId);
  if (!room) return;

  const data = JSON.stringify(message);
  for (const [uid, user] of room.users.entries()) {
    if (uid !== senderId && user.ws.readyState === user.ws.OPEN) {
      user.ws.send(data);
    }
  }
}

export function sendToUser(userId: string, message: object): void {
  for (const room of rooms.values()) {
    const user = room.users.get(userId);
    if (user && user.ws.readyState === user.ws.OPEN) {
      user.ws.send(JSON.stringify(message));
      return;
    }
  }
}

export function setUserAudioEnabled(userId: string, enabled: boolean): void {
  for (const room of rooms.values()) {
    const user = room.users.get(userId);
    if (user) {
      user.isAudioEnabled = enabled;
      return;
    }
  }
}

export function setUserVideoEnabled(userId: string, enabled: boolean): void {
  for (const room of rooms.values()) {
    const user = room.users.get(userId);
    if (user) {
      user.isVideoEnabled = enabled;
      return;
    }
  }
}
