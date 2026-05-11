import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { POST_JOB } from './postJobTheme';

type Props = {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (next: string) => void;
};

export default function PostJobChipSelect({
  label,
  options,
  value,
  onChange,
}: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.row}>
        {options.map((opt) => {
          const active = value === opt;
          return (
            <Pressable
              key={opt}
              onPress={() => onChange(opt)}
              style={({ pressed }) => [
                styles.chip,
                active ? styles.chipActive : styles.chipIdle,
                pressed && { opacity: 0.85 },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text
                style={[styles.chipText, active ? styles.chipTextActive : styles.chipTextIdle]}
              >
                {opt}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: POST_JOB.navy,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  chipIdle: {
    backgroundColor: POST_JOB.white,
    borderColor: POST_JOB.border,
  },
  chipActive: {
    backgroundColor: POST_JOB.inputBg,
    borderColor: POST_JOB.navy,
  },
  chipText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
  },
  chipTextIdle: {
    color: POST_JOB.muted,
  },
  chipTextActive: {
    color: POST_JOB.deep,
    fontFamily: 'Poppins_500Medium',
  },
});
