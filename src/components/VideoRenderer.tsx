import React from 'react';
import { View } from 'react-native';

interface Props {
  stream: any;
  style?: any;
  mirror?: boolean;
  muted?: boolean;
  objectFit?: 'cover' | 'contain';
  zOrder?: number;
}

export default function VideoRenderer({ style }: Props) {
  return <View style={style} />;
}
