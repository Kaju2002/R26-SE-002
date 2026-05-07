import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const TITLE = '#202871';
const SUBTITLE = '#858BBD';

type Props = {
  title?: string;
  subtitle?: string;
};

export default function NotificationsEmptyState({
  title = 'Empty',
  subtitle = 'You don\u2019t have any notifications at this time',
}: Props) {
  return (
    <View style={styles.wrap}>
      <Image
        source={require('../../../assets/icons/np+nofification.png')}
        style={styles.illustration}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingBottom: 48,
  },
  illustration: {
    width: 220,
    height: 220,
    marginBottom: 24,
  },
  /** "Empty" — Poppins Medium 18 · #202871 */
  title: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 18,
    color: TITLE,
    marginBottom: 6,
    textAlign: 'center',
  },
  /** Subtitle — Poppins Regular 14 · #858BBD */
  subtitle: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: SUBTITLE,
    textAlign: 'center',
    lineHeight: 20,
  },
});
