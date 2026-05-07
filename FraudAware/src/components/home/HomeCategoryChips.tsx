import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

const NAVY = '#202871';
const BORDER = '#D6DAEA';

/** Chip row height — keep in sync with chip height + row padding */
const CHIP_SCROLL_HEIGHT = 34 + 14;

export type HomeCategory = 'All' | 'Banking' | 'IT' | 'Finance' | 'Marketing' | 'Engineering';

const CHIPS: HomeCategory[] = [
  'All',
  'Banking',
  'IT',
  'Finance',
  'Marketing',
  'Engineering',
];

type Props = {
  active: HomeCategory;
  onSelect: (category: HomeCategory) => void;
};

export default function HomeCategoryChips({ active, onSelect }: Props) {
  return (
    <ScrollView
      horizontal
      style={styles.chipsScroll}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      nestedScrollEnabled
    >
      {CHIPS.map((label) => {
        const isActive = label === active;
        return (
          <Pressable
            key={label}
            onPress={() => onSelect(label)}
            style={[
              styles.chip,
              isActive && styles.chipActive,
            ]}
          >
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chipsScroll: {
    flexGrow: 0,
    flexShrink: 0,
    maxHeight: CHIP_SCROLL_HEIGHT,
    height: CHIP_SCROLL_HEIGHT,
  },
  row: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 14,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: NAVY,
    borderColor: NAVY,
  },
  label: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: NAVY,
  },
  labelActive: {
    fontFamily: 'Poppins_500Medium',
    color: '#FFFFFF',
  },
});
