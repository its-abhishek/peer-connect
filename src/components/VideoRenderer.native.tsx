import React from 'react';
import { RTCView } from 'react-native-webrtc';

interface Props {
  stream: import('react-native-webrtc').MediaStream | null;
  style?: any;
  mirror?: boolean;
  muted?: boolean;
  objectFit?: 'cover' | 'contain';
  zOrder?: number;
}

export default function VideoRenderer({ stream, style, mirror, objectFit = 'cover', zOrder }: Props) {
  if (!stream) return null;
  return (
    <RTCView
      streamURL={stream.toURL()}
      style={style}
      objectFit={objectFit}
      mirror={!!mirror}
      zOrder={zOrder || 0}
    />
  );
}
