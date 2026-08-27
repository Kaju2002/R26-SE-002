import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { INCHAT_BORDER, INCHAT_MUTED, INCHAT_NAVY } from './inchatStyles';

type Props = {
  labels: string[];
  activeIndex: number;
  onSelect: (index: number) => void;
};

export default function InchatApplicationSwitcher({
  labels,
  activeIndex,
  onSelect,
}: Props) {
  if (labels.length <= 1) {
    return null;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.wrap}
    >
      {labels.map((label, index) => {
        const isActive = index === activeIndex;
        return (
          <Pressable
            key={`${label}-${index}`}
            onPress={() => onSelect(index)}
            style={[styles.chip, isActive ? styles.chipActive : styles.chipIdle]}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
          >
            <Text style={[styles.chipText, isActive ? styles.chipTextActive : styles.chipTextIdle]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexGrow: 0,
  },
  row: {
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: 220,
  },
  chipActive: {
    borderColor: INCHAT_NAVY,
    backgroundColor: '#EEF0F8',
  },
  chipIdle: {
    borderColor: INCHAT_BORDER,
    backgroundColor: '#fff',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  chipTextActive: {
    color: INCHAT_NAVY,
  },
  chipTextIdle: {
    color: INCHAT_MUTED,
  },
});
