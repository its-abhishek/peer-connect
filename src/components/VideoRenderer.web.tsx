import React, { useRef, useEffect } from 'react';

interface Props {
  stream: MediaStream | null;
  style?: any;
  mirror?: boolean;
  muted?: boolean;
  objectFit?: 'cover' | 'contain';
}

export default function VideoRenderer({ stream, style, mirror, muted = false, objectFit = 'cover' }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
  }, [stream]);

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
