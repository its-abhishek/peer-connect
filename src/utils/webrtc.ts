import { mediaDevices, MediaStream } from 'react-native-webrtc';
import type { IceCandidatePayload, SdpPayload } from '../types';

const ICE_SERVERS: RTCIceServer[] = [
  {
    urls: 'stun:stun.l.google.com:19302',
  },
  {
    urls: 'stun:stun1.l.google.com:19302',
  },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

const PEER_CONNECTION_CONFIG: RTCConfiguration = {
  iceServers: ICE_SERVERS,
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
  iceTransportPolicy: 'all',
};

export function createPeerConnection(
  onIceCandidate: (candidate: IceCandidatePayload) => void,
  onTrack: (stream: MediaStream) => void,
  onConnectionStateChange: (state: string) => void,
): RTCPeerConnection {
  const pc = new RTCPeerConnection(PEER_CONNECTION_CONFIG);

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      onIceCandidate({
        candidate: event.candidate.candidate,
        sdpMid: event.candidate.sdpMid,
        sdpMLineIndex: event.candidate.sdpMLineIndex,
      });
    }
  };

  pc.ontrack = (event) => {
    if (event.streams[0]) {
      onTrack(event.streams[0] as unknown as MediaStream);
    }
  };

  pc.onconnectionstatechange = () => {
    onConnectionStateChange(pc.connectionState);
  };

  return pc;
}

export async function createOffer(pc: RTCPeerConnection): Promise<RTCSessionDescriptionInit> {
  const offer = await pc.createOffer({
    offerToReceiveAudio: true,
    offerToReceiveVideo: true,
  });
  await pc.setLocalDescription(offer);
  return offer;
}

export async function createAnswer(pc: RTCPeerConnection): Promise<RTCSessionDescriptionInit> {
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  return answer;
}

export async function setRemoteDescription(
  pc: RTCPeerConnection,
  sdpPayload: SdpPayload,
): Promise<void> {
  const desc: RTCSessionDescriptionInit = {
    type: sdpPayload.type,
    sdp: sdpPayload.sdp,
  };
  await pc.setRemoteDescription(desc);
}

export async function addIceCandidate(
  pc: RTCPeerConnection,
  candidate: IceCandidatePayload,
): Promise<void> {
  try {
    await pc.addIceCandidate(
      new RTCIceCandidate({
        candidate: candidate.candidate,
        sdpMid: candidate.sdpMid || '',
        sdpMLineIndex: candidate.sdpMLineIndex ?? -1,
      }),
    );
  } catch {
  }
}

export async function getLocalStream(
  audio: boolean = true,
  video: boolean = false,
): Promise<MediaStream | null> {
  try {
    const constraints = {
      audio,
      video: video ? { facingMode: 'user' as const, frameRate: 30, width: 1280, height: 720 } : false,
    };
    console.log('[WebRTC] getUserMedia constraints:', constraints);
    const stream = await mediaDevices.getUserMedia(constraints as any);
    console.log('[WebRTC] Got local stream:', stream);
    return stream;
  } catch (error) {
    console.error('[WebRTC] getUserMedia error:', error);
    return null;
  }
}

export async function switchCamera(stream: MediaStream | null): Promise<void> {
  if (!stream) return;
  const videoTracks = stream.getVideoTracks();
  if (videoTracks.length > 0) {
    (videoTracks[0] as unknown as { _switchCamera: () => void })._switchCamera();
  }
}

export async function getDisplayStream(): Promise<MediaStream | null> {
  try {
    const stream = await mediaDevices.getDisplayMedia();
    return stream;
  } catch {
    return null;
  }
}

export function toggleAudioTrack(stream: MediaStream | null, enabled: boolean): void {
  if (!stream) return;
  const audioTracks = stream.getAudioTracks();
  if (audioTracks.length > 0) {
    audioTracks[0].enabled = enabled;
  }
}

export function toggleVideoTrack(stream: MediaStream | null, enabled: boolean): void {
  if (!stream) return;
  const videoTracks = stream.getVideoTracks();
  if (videoTracks.length > 0) {
    videoTracks[0].enabled = enabled;
  }
}

export function getConnectionQuality(
  connectionState: string,
): 'good' | 'poor' | 'disconnected' {
  if (connectionState === 'connected') return 'good';
  if (connectionState === 'connecting' || connectionState === 'new') return 'poor';
  return 'disconnected';
}

export function stopMediaStream(stream: MediaStream | null): void {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
  if (typeof (stream as any).release === 'function') {
    (stream as any).release();
  }
}

export { MediaStream };
