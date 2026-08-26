import React from 'react';
import { MaterialIcons } from '@expo/vector-icons';

/**
 * Closest Expo glyph to material-symbols:verified-user-outline
 * (Material Icons `verified-user`, Apache 2.0).
 */
export default function VerifiedUserOutlineIcon({
  size = 24,
  color = '#2E7D32',
}: {
  size?: number;
  color?: string;
}) {
  return (
    <MaterialIcons
      name="verified-user"
      size={size}
      color={color}
      accessibilityLabel="Verified company"
    />
  );
}
