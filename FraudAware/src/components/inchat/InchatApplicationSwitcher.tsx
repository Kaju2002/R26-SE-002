import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
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
            accessibilityLabel={`Switch to ${label}`}
          >
            <Text
              numberOfLines={1}
              style={[styles.chipText, isActive ? styles.chipTextActive : styles.chipTextIdle]}
            >
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
    paddingRight: 8,
    alignItems: 'center',
  },
  chip: {
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxWidth: 200,
  },
  chipActive: {
    borderColor: INCHAT_NAVY,
    backgroundColor: INCHAT_NAVY,
  },
  chipIdle: {
    borderColor: INCHAT_BORDER,
    backgroundColor: '#fff',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  chipTextActive: {
    color: '#fff',
  },
  chipTextIdle: {
    color: INCHAT_MUTED,
  },
});
