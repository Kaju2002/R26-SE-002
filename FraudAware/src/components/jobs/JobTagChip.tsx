import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export type ChipTone = 'neutral' | 'navy' | 'amber' | 'green';

const TONES: Record<
  ChipTone,
  { bg: string; border: string; text: string }
> = {
  neutral: { bg: '#FFFFFF', border: '#D6DAEA', text: '#858BBD' },
  navy: { bg: '#E8EBFA', border: '#C5CBE8', text: '#42498A' },
  amber: { bg: '#FFF5E6', border: '#FFD699', text: '#C47F08' },
  green: { bg: '#E8F6EE', border: '#B8E0C8', text: '#1B7A3D' },
};

type Props = {
  label: string;
  tone?: ChipTone;
};

export default function JobTagChip({ label, tone = 'neutral' }: Props) {
  const c = TONES[tone];
  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: c.bg, borderColor: c.border },
      ]}
    >
      <Text style={[styles.label, { color: c.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  /** Tag — Poppins Regular 12 */
  label: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
  },
});
