import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { tacticKeyToChipLabel } from '../../utils/tacticLabels';

type Props = {
  score?: number | null;
  tactics?: string[];
  onReport?: () => void;
};

/**
 * Safety strip inside the flagged message bubble (one card).
 * Only warning text/icons use red — bubble stays normal.
 */
export default function InchatScamSafetyBanner({ tactics = [], onReport }: Props) {
  const labels = tactics.map(tacticKeyToChipLabel).filter(Boolean).slice(0, 2);
  const hint = labels.length ? labels.join(' · ') : null;

  return (
    <View
      style={styles.strip}
      accessibilityRole="summary"
      accessibilityLabel="This message looks unsafe. Don’t send money or personal details."
    >
      <MaterialCommunityIcons name="shield-alert-outline" size={16} color="#DC2626" />
      <View style={styles.copy}>
        <Text style={styles.title}>This message looks unsafe</Text>
        <Text style={styles.body}>Don’t send money or personal details.</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      {onReport ? (
        <Pressable
          style={styles.reportIconBtn}
          onPress={onReport}
          accessibilityRole="button"
          accessibilityLabel="Report this chat"
          hitSlop={8}
        >
          <MaterialCommunityIcons name="flag-outline" size={18} color="#DC2626" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 9,
    paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
    marginBottom: 1,
  },
  body: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500',
    color: '#DC2626',
  },
  hint: {
    marginTop: 3,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
    color: '#EF4444',
  },
  reportIconBtn: {
    padding: 2,
  },
});
