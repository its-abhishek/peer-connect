import { useState, useRef, useCallback, useEffect } from 'react';
import { MediaStream } from '../utils/webrtc';
import type { User, CallStatus, ConnectionQuality, MediaType } from '../types';
import type { IceCandidatePayload, SdpPayload } from '../types';
import {
  createPeerConnection,
  createOffer,
  createAnswer,
  setRemoteDescription,
  addIceCandidate,
  getLocalStream,
  getDisplayStream,
  toggleAudioTrack,
  toggleVideoTrack,
  switchCamera as switchCameraUtil,
  getConnectionQuality,
  stopMediaStream,
} from '../utils/webrtc';

interface PeerConnection {
  pc: RTCPeerConnection;
  peerUserId: string;
}

interface UseWebRTCConfig {
  userId: string;
  sendSignalingMessage: (msg: object) => void;
}

interface UseWebRTCReturn {
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  callStatus: CallStatus;
  connectionQuality: ConnectionQuality;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  mediaType: MediaType;
  speakingUsers: Set<string>;
  startCall: (users: User[]) => Promise<void>;
  endCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => Promise<void>;
  switchCamera: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  handleOffer: (senderId: string, sdpPayload: SdpPayload) => Promise<void>;
  handleAnswer: (senderId: string, sdpPayload: SdpPayload) => Promise<void>;
  handleIceCandidate: (senderId: string, candidate: IceCandidatePayload) => Promise<void>;
  handleUserLeft: (userId: string) => void;
  connectToUser: (userId: string, displayName: string) => Promise<void>;
}

export function useWebRTC(config: UseWebRTCConfig): UseWebRTCReturn {
  const configRef = useRef(config);
  configRef.current = config;

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>('disconnected');
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [mediaType, setMediaType] = useState<MediaType>('voice');
  const [speakingUsers, setSpeakingUsers] = useState<Set<string>>(new Set());

  const peersRef = useRef<Map<string, PeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const speakingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const addTracksToPeer = useCallback((pc: RTCPeerConnection, stream: MediaStream) => {
    stream.getTracks().forEach((track) => {
      (pc as any).addTrack(track, stream);
    });
  }, []);

  const replaceTrackOnPeers = useCallback(async (newStream: MediaStream) => {
    const promises: Promise<void>[] = [];
    for (const [, { pc }] of peersRef.current) {
      const senders = pc.getSenders();
      for (const track of newStream.getTracks()) {
        const sender = senders.find((s) => s.track?.kind === (track as any).kind);
        if (sender) {
          promises.push((sender as any).replaceTrack(track));
        }
      }
    }
    await Promise.all(promises);
  }, []);

  const connectToPeer = useCallback(async (targetUser: User): Promise<void> => {
    if (peersRef.current.has(targetUser.id)) return;

    const remoteStream = new MediaStream();
    setRemoteStreams((prev) => new Map(prev).set(targetUser.id, remoteStream));

    const pc = createPeerConnection(
      (candidate) => {
        configRef.current.sendSignalingMessage({
          type: 'ice-candidate',
          senderId: configRef.current.userId,
          targetId: targetUser.id,
          payload: candidate,
        });
      },
      (stream) => {
        for (const track of stream.getTracks()) {
          remoteStream.addTrack(track);
        }
        setRemoteStreams((prev) => new Map(prev));
      },
      (state) => {
        setConnectionQuality(getConnectionQuality(state));
        if (state === 'connected') {
          setCallStatus('connected');
        } else if ((state === 'disconnected' || state === 'failed') && peersRef.current.has(targetUser.id)) {
          setCallStatus('reconnecting');
        }
      },
    );

    if (localStreamRef.current) {
      addTracksToPeer(pc, localStreamRef.current);
    }

    peersRef.current.set(targetUser.id, { pc, peerUserId: targetUser.id });
    const offer = await createOffer(pc);

    configRef.current.sendSignalingMessage({
      type: 'offer',
      senderId: configRef.current.userId,
      targetId: targetUser.id,
      payload: { sdp: offer.sdp, type: offer.type },
    });
  }, [addTracksToPeer]);

  const startCall = useCallback(async (users: User[]): Promise<void> => {
    setCallStatus('connecting');
    const stream = await getLocalStream(true, false);
    if (stream) {
      localStreamRef.current = stream;
      setLocalStream(stream);
    }
    await Promise.all(users.map((user) => connectToPeer(user)));
  }, [connectToPeer]);

  const connectToUser = useCallback(async (peerId: string, displayName: string) => {
    if (peersRef.current.has(peerId)) return;
    const user: User = {
      id: peerId,
      peerId,
      displayName,
      isAudioEnabled: true,
      isVideoEnabled: false,
      isSpeaking: false,
      joinTimestamp: Date.now(),
    };
    await connectToPeer(user);
  }, [connectToPeer]);

  const endCall = useCallback(() => {
    for (const [, { pc }] of peersRef.current) {
      pc.close();
    }
    peersRef.current.clear();
    setRemoteStreams(new Map());
    stopMediaStream(localStreamRef.current);
    localStreamRef.current = null;
    setLocalStream(null);
    setCallStatus('idle');
    setConnectionQuality('disconnected');
    setIsAudioEnabled(true);
    setIsVideoEnabled(false);
    setIsScreenSharing(false);
    setMediaType('voice');
    setSpeakingUsers(new Set());
  }, []);

  const toggleMute = useCallback(() => {
    const newEnabled = !isAudioEnabled;
    setIsAudioEnabled(newEnabled);
    toggleAudioTrack(localStreamRef.current, newEnabled);
  }, [isAudioEnabled]);

  const toggleVideo = useCallback(async () => {
    if (isVideoEnabled) {
      toggleVideoTrack(localStreamRef.current, false);
      setIsVideoEnabled(false);
      setMediaType('voice');
    } else {
      const stream = await getLocalStream(true, true);
      if (stream) {
        if (localStreamRef.current) {
          for (const t of localStreamRef.current.getVideoTracks()) {
            t.stop();
            localStreamRef.current.removeTrack(t);
          }
          for (const t of stream.getVideoTracks()) {
            localStreamRef.current.addTrack(t);
          }
          stream.release();
        } else {
          localStreamRef.current = stream;
        }
        setLocalStream(localStreamRef.current);
        await replaceTrackOnPeers(localStreamRef.current);
        setIsVideoEnabled(true);
        setMediaType('video');
      }
    }
  }, [isVideoEnabled, replaceTrackOnPeers]);

  const handleSwitchCamera = useCallback(async () => {
    await switchCameraUtil(localStreamRef.current);
  }, []);

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      setIsScreenSharing(false);
    } else {
      const displayStream = await getDisplayStream();
      if (displayStream && localStreamRef.current) {
        const videoTrack = displayStream.getVideoTracks()[0];
        if (videoTrack) {
          localStreamRef.current.addTrack(videoTrack);
          await replaceTrackOnPeers(localStreamRef.current);
          setLocalStream(localStreamRef.current);
        }
        setIsScreenSharing(true);
      }
    }
  }, [isScreenSharing, replaceTrackOnPeers]);

  const handleOffer = useCallback(async (senderId: string, sdpPayload: SdpPayload) => {
    if (peersRef.current.has(senderId)) return;

    const remoteStream = new MediaStream();
    setRemoteStreams((prev) => new Map(prev).set(senderId, remoteStream));

    const pc = createPeerConnection(
      (candidate) => {
        configRef.current.sendSignalingMessage({
          type: 'ice-candidate',
          senderId: configRef.current.userId,
          targetId: senderId,
          payload: candidate,
        });
      },
      (stream) => {
        for (const track of stream.getTracks()) {
          remoteStream.addTrack(track);
        }
        setRemoteStreams((prev) => new Map(prev));
      },
      (state) => {
        setConnectionQuality(getConnectionQuality(state));
        if (state === 'connected') {
          setCallStatus('connected');
        } else if ((state === 'disconnected' || state === 'failed') && peersRef.current.has(senderId)) {
          setCallStatus('reconnecting');
        }
      },
    );

    if (localStreamRef.current) {
      addTracksToPeer(pc, localStreamRef.current);
    }

    peersRef.current.set(senderId, { pc, peerUserId: senderId });
    await setRemoteDescription(pc, sdpPayload);

    const answer = await createAnswer(pc);
    configRef.current.sendSignalingMessage({
      type: 'answer',
      senderId: configRef.current.userId,
      targetId: senderId,
      payload: { sdp: answer.sdp, type: answer.type },
    });
  }, [addTracksToPeer]);

  const handleAnswer = useCallback(async (senderId: string, sdpPayload: SdpPayload) => {
    const peer = peersRef.current.get(senderId);
    if (!peer) return;
    await setRemoteDescription(peer.pc, sdpPayload);
  }, []);

  const handleIceCandidate = useCallback(async (senderId: string, candidate: IceCandidatePayload) => {
    const peer = peersRef.current.get(senderId);
    if (!peer) return;
    await addIceCandidate(peer.pc, candidate);
  }, []);

  const handleUserLeft = useCallback((leftUserId: string) => {
    const peer = peersRef.current.get(leftUserId);
    if (peer) {
      peer.pc.close();
      peersRef.current.delete(leftUserId);
    }
    setRemoteStreams((prev) => {
      const next = new Map(prev);
      next.delete(leftUserId);
      return next;
    });
    if (peersRef.current.size === 0) {
      setCallStatus('disconnected');
      setConnectionQuality('disconnected');
    }
  }, []);

  useEffect(() => {
    if (!localStream || mediaType === 'voice') return;
    const audioTracks = localStream.getAudioTracks();
    if (audioTracks.length === 0) return;

    try {
      const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const source = ctx.createMediaStreamSource(localStream as any);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkSpeaking = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / bufferLength;
        if (avg > 30) {
          setSpeakingUsers((prev) => new Set(prev).add('local'));
          const timer = speakingTimersRef.current.get('local');
          if (timer) clearTimeout(timer);
          speakingTimersRef.current.set(
            'local',
            setTimeout(() => {
              setSpeakingUsers((prev) => {
                const next = new Set(prev);
                next.delete('local');
                return next;
              });
            }, 1000),
          );
        }
      };

      const interval = setInterval(checkSpeaking, 200);
      return () => {
        clearInterval(interval);
        ctx.close();
      };
    } catch {
    }
  }, [localStream, mediaType]);

  return {
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
    endCall,
    toggleMute,
    toggleVideo,
    switchCamera: handleSwitchCamera,
    toggleScreenShare,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    handleUserLeft,
    connectToUser,
  };
}
