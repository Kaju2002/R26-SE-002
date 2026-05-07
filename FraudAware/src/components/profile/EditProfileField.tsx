import React, { useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const NAVY = '#202871';
const BORDER_IDLE = '#D6DBF0';
const FOCUSED_FILL = '#F7F8FE';
const PLACEHOLDER = '#9AA1B5';
const VALUE = '#202871';

type Props = {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  trailingIcon?: 'calendar';
  onTrailingIconPress?: () => void;
  editable?: boolean;
};

export default function EditProfileField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  trailingIcon,
  onTrailingIconPress,
  editable = true,
}: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.block}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.inputRow,
          focused && styles.inputRowFocused,
        ]}
      >
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          placeholderTextColor={PLACEHOLDER}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          editable={editable}
          selectionColor={NAVY}
        />
        {trailingIcon === 'calendar' && (
          <Pressable
            onPress={onTrailingIconPress}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Pick date"
          >
            <Ionicons name="calendar-outline" size={20} color={NAVY} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    marginBottom: 14,
  },
  /** Field label — Poppins Medium 14 · #202871 */
  label: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: NAVY,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 46,
    borderWidth: 1,
    borderColor: BORDER_IDLE,
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
  },
  /** Focused field — navy border + soft tint (matches design) */
  inputRowFocused: {
    borderWidth: 1.5,
    borderColor: NAVY,
    backgroundColor: FOCUSED_FILL,
  },
  /** Input value — Poppins Regular 14 · #202871 */
  input: {
    flex: 1,
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: VALUE,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
  },
});
