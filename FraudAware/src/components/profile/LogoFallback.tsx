import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';
import type { LogoFallbackData } from '../../../data/profileDetails';

type Props = {
  source?: ImageSourcePropType;
  uri?: string;
  fallback?: LogoFallbackData;
  size?: number;
  borderRadius?: number;
};

export default function LogoFallback({
  source,
  uri,
  fallback,
  size = 40,
  borderRadius = 8,
}: Props) {
  const dimensions = { width: size, height: size, borderRadius };

  if (source) {
    return (
      <Image
        source={source}
        style={[styles.image, dimensions]}
        resizeMode="cover"
      />
    );
  }

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.image, dimensions]}
        resizeMode="cover"
      />
    );
  }

  const text = fallback?.text ?? '?';
  const bg = fallback?.bg ?? '#E5E7EE';
  const color = fallback?.color ?? '#202871';

  return (
    <View
      style={[
        styles.fallback,
        dimensions,
        { backgroundColor: bg },
      ]}
    >
      <Text
        style={[
          styles.fallbackText,
          { color, fontSize: Math.max(11, Math.floor(size * 0.36)) },
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: '#EAECF2',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    fontFamily: 'Poppins_500Medium',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
