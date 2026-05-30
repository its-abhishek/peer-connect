const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

const PC_CONFIG: RTCConfiguration = {
  iceServers: ICE_SERVERS,
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
  iceTransportPolicy: 'all',
};

export function createPeerConnection(
  onIceCandidate: (candidate: { candidate: string; sdpMid: string | null; sdpMLineIndex: number | null }) => void,
  onTrack: (stream: MediaStream) => void,
  onConnectionStateChange: (state: string) => void,
): RTCPeerConnection {
  const pc = new RTCPeerConnection(PC_CONFIG);

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
      onTrack(event.streams[0]);
    }
  };

  pc.onconnectionstatechange = () => {
    onConnectionStateChange(pc.connectionState);
  };

  return pc;
}

export async function createOffer(pc: RTCPeerConnection): Promise<RTCSessionDescriptionInit> {
  const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
  await pc.setLocalDescription(offer);
  return offer;
}

export async function createAnswer(pc: RTCPeerConnection): Promise<RTCSessionDescriptionInit> {
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  return answer;
}

export async function setRemoteDescription(pc: RTCPeerConnection, sdpPayload: { sdp: string; type: RTCSdpType }): Promise<void> {
  await pc.setRemoteDescription({ type: sdpPayload.type, sdp: sdpPayload.sdp });
}

export async function addIceCandidate(pc: RTCPeerConnection, candidate: { candidate: string; sdpMid: string | null; sdpMLineIndex: number | null }): Promise<void> {
  try {
    await pc.addIceCandidate(new RTCIceCandidate({ candidate: candidate.candidate, sdpMid: candidate.sdpMid || '', sdpMLineIndex: candidate.sdpMLineIndex ?? -1 }));
  } catch {}
}

export async function getLocalStream(audio = true, video = false): Promise<MediaStream | null> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio,
      video: video ? { facingMode: 'user', frameRate: 30, width: { ideal: 1280 }, height: { ideal: 720 } } : false,
    });
  } catch { return null; }
}

export async function switchCamera(stream: MediaStream | null): Promise<void> {
  if (!stream) return;
  const track = stream.getVideoTracks()[0];
  if (track) {
    const settings = track.getSettings();
    try {
      await (track as any).applyConstraints({ facingMode: settings.facingMode === 'user' ? 'environment' : 'user' });
    } catch {}
  }
}

export async function getDisplayStream(): Promise<MediaStream | null> {
  try {
    return await (navigator.mediaDevices as any).getDisplayMedia({ video: true });
  } catch { return null; }
}

export function toggleAudioTrack(stream: MediaStream | null, enabled: boolean): void {
  stream?.getAudioTracks().forEach(t => t.enabled = enabled);
}

export function toggleVideoTrack(stream: MediaStream | null, enabled: boolean): void {
  stream?.getVideoTracks().forEach(t => t.enabled = enabled);
}

export function getConnectionQuality(state: string): 'good' | 'poor' | 'disconnected' {
  if (state === 'connected') return 'good';
  if (state === 'connecting' || state === 'new') return 'poor';
  return 'disconnected';
}

export function stopMediaStream(stream: MediaStream | null): void {
  if (!stream) return;
  stream.getTracks().forEach(t => t.stop());
}

export { MediaStream } from './shim';
