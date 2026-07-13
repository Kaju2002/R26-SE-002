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
  title: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 20,
    lineHeight: 28,
    color: TITLE,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    color: SUBTITLE,
    textAlign: 'center',
    lineHeight: 24,
  },
});
