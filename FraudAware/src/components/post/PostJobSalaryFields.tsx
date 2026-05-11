import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { POST_JOB } from './postJobTheme';

type Props = {
  salaryMin: string;
  salaryMax: string;
  currency: string;
  salaryPeriod: string;
  onSalaryMin: (t: string) => void;
  onSalaryMax: (t: string) => void;
  onCurrency: (t: string) => void;
  onSalaryPeriod: (t: string) => void;
};

export default function PostJobSalaryFields({
  salaryMin,
  salaryMax,
  currency,
  salaryPeriod,
  onSalaryMin,
  onSalaryMax,
  onCurrency,
  onSalaryPeriod,
}: Props) {
  return (
    <View>
      <View style={styles.pair}>
        <View style={styles.half}>
          <Text style={styles.label}>Min salary</Text>
          <TextInput
            value={salaryMin}
            onChangeText={onSalaryMin}
            placeholder="0"
            placeholderTextColor={POST_JOB.mutedLight}
            keyboardType="numeric"
            style={styles.input}
          />
        </View>
        <View style={styles.half}>
          <Text style={styles.label}>Max salary</Text>
          <TextInput
            value={salaryMax}
            onChangeText={onSalaryMax}
            placeholder="0"
            placeholderTextColor={POST_JOB.mutedLight}
            keyboardType="numeric"
            style={styles.input}
          />
        </View>
      </View>
      <View style={styles.pair}>
        <View style={styles.half}>
          <Text style={styles.label}>Currency</Text>
          <TextInput
            value={currency}
            onChangeText={onCurrency}
            placeholder="GHS"
            placeholderTextColor={POST_JOB.mutedLight}
            autoCapitalize="characters"
            style={styles.input}
          />
        </View>
        <View style={styles.half}>
          <Text style={styles.label}>Period</Text>
          <TextInput
            value={salaryPeriod}
            onChangeText={onSalaryPeriod}
            placeholder="monthly"
            placeholderTextColor={POST_JOB.mutedLight}
            style={styles.input}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pair: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  half: {
    flex: 1,
  },
  label: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: POST_JOB.navy,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: POST_JOB.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: POST_JOB.navy,
    backgroundColor: POST_JOB.inputBg,
  },
});
