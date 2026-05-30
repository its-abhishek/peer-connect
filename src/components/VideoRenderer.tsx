import React, { useRef, useEffect } from 'react';
import { View } from 'react-native';
import { mediaDevices } from 'react-native-webrtc';

interface Props {
  stream: any;
  style?: any;
  mirror?: boolean;
  muted?: boolean;
  objectFit?: 'cover' | 'contain';
  zOrder?: number;
}

// Check if running on web
const isWeb = typeof document !== 'undefined';

export default function VideoRenderer({ stream, style, mirror, muted = false, objectFit = 'cover' }: Props) {
  const videoRef = useRef<HTMLVideoElement | any>(null);

  useEffect(() => {
    if (isWeb) {
      const video = videoRef.current as HTMLVideoElement;
      if (!video) return;
      video.srcObject = stream;
    }
  }, [stream]);

  if (isWeb) {
    return (
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        style={{
          width: '100%',
          height: '100%',
          objectFit,
          transform: mirror ? 'scaleX(-1)' : 'none',
          ...(style || {}),
        }}
      />
    );
  }

  // Native fallback - just show a placeholder
  return <View style={[{ backgroundColor: '#000' }, style]} />;
}
