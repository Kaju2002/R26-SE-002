import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

const NAVY = '#202871';
const PILL_BORDER = '#C9D2E0';

type Props = {
  label: string;
};

export default function SkillPill({ label }: Props) {
  return (
    <View style={styles.pill}>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderWidth: 1,
    borderColor: PILL_BORDER,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
  },
  /** Skill — Poppins Regular 12 · #202871 */
  label: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: NAVY,
  },
});
