import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { tacticKeyToChipLabel } from '../../utils/tacticLabels';

type Props = {
  score?: number | null;
  tactics?: string[];
  onReport?: () => void;
  /** `unsafe` = scam detected (red); `caution` = suspicious, not confirmed (orange). */
  variant?: 'unsafe' | 'caution';
};

const VARIANTS = {
  unsafe: {
    icon: 'shield-alert-outline' as const,
    color: '#DC2626',
    hintColor: '#EF4444',
    title: 'This message looks unsafe',
    body: 'Don’t send money or personal details.',
  },
  caution: {
    icon: 'alert-outline' as const,
    color: '#C2410C',
    hintColor: '#EA580C',
    title: 'Be careful with this message',
    body: 'Some scam-like signs. Verify the employer before sharing money or personal details.',
  },
};

/**
 * Safety strip inside a flagged or suspicious message bubble (one card).
 * Only warning text/icons are coloured — bubble stays normal.
 */
export default function InchatScamSafetyBanner({
  tactics = [],
  onReport,
  variant = 'unsafe',
}: Props) {
  const v = VARIANTS[variant];
  const labels = tactics.map(tacticKeyToChipLabel).filter(Boolean).slice(0, 2);
  const hint = labels.length ? labels.join(' · ') : null;

  return (
    <View
      style={styles.strip}
      accessibilityRole="summary"
      accessibilityLabel={`${v.title}. ${v.body}`}
    >
      <MaterialCommunityIcons name={v.icon} size={16} color={v.color} />
      <View style={styles.copy}>
        <Text style={[styles.title, { color: v.color }]}>{v.title}</Text>
        <Text style={[styles.body, { color: v.color }]}>{v.body}</Text>
        {hint ? <Text style={[styles.hint, { color: v.hintColor }]}>{hint}</Text> : null}
      </View>
      {onReport ? (
        <Pressable
          style={styles.reportIconBtn}
          onPress={onReport}
          accessibilityRole="button"
          accessibilityLabel="Report this chat"
          hitSlop={8}
        >
          <MaterialCommunityIcons name="flag-outline" size={18} color={v.color} />
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
    marginBottom: 1,
  },
  body: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500',
  },
  hint: {
    marginTop: 3,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
  },
  reportIconBtn: {
    padding: 2,
  },
});
