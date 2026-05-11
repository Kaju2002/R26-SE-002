import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { POST_JOB } from './postJobTheme';

type Props = {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  multiline?: boolean;
  minHeight?: number;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad' | 'url';
};

export default function PostJobTextField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  minHeight,
  keyboardType = 'default',
}: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={POST_JOB.mutedLight}
        style={[styles.input, multiline && { minHeight: minHeight ?? 100 }]}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        keyboardType={keyboardType}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 12,
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
