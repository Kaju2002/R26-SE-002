import React from 'react';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  size?: number;
  color?: string;
};

export default function ChatIcon({ size = 24, color = '#202871' }: Props) {
  return <Ionicons name="chatbubble-ellipses" size={size} color={color} />;
}
