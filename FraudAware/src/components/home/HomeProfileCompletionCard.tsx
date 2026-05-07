import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getProfileCompletionPercent } from '../../utils/profileCompletion';

const NAVY = '#202871';
const MUTED = '#858BBD';
const BORDER = '#D6DAEA';
const TRACK = '#EEF0F8';

type Props = {
  onCompletePress: () => void;
};

export default function HomeProfileCompletionCard({ onCompletePress }: Props) {
  const pct = getProfileCompletionPercent();
  if (pct >= 100) return null;

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.title}>Profile strength</Text>
        <Text style={styles.pct}>{pct}%</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
      <Pressable
        onPress={onCompletePress}
        style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
      >
        <Text style={styles.ctaText}>Complete profile</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#F7F8FE',
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: NAVY,
  },
  pct: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: NAVY,
  },
  track: {
    height: 8,
    borderRadius: 999,
    backgroundColor: TRACK,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: NAVY,
  },
  cta: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  ctaText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: NAVY,
    textDecorationLine: 'underline',
  },
});
