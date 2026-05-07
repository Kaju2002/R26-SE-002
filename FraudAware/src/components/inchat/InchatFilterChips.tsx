import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { InchatFilterId } from '../../../data/inchatThreads';
import { INCHAT_BORDER, INCHAT_MUTED, INCHAT_NAVY } from './inchatStyles';

type ChipOption = { id: InchatFilterId; label: string };

type Props = {
  options: ChipOption[];
  activeId: InchatFilterId;
  onSelect: (id: InchatFilterId) => void;
};

export default function InchatFilterChips({ options, activeId, onSelect }: Props) {
  return (
    <View style={styles.row}>
      {options.map((opt) => {
        const active = opt.id === activeId;
        return (
          <Pressable
            key={opt.id}
            onPress={() => onSelect(opt.id)}
            style={[styles.chip, active && styles.chipActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{opt.label}</Text>
            {active ? (
              <MaterialCommunityIcons
                name="chevron-down"
                size={14}
                color="#fff"
                style={styles.chevron}
              />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: INCHAT_BORDER,
    backgroundColor: '#fff',
    gap: 4,
  },
  chipActive: {
    backgroundColor: INCHAT_NAVY,
    borderColor: INCHAT_NAVY,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: INCHAT_NAVY,
  },
  labelActive: {
    color: '#fff',
  },
  chevron: {
    marginLeft: 2,
  },
});
