import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const NAVY = '#202871';

type Props = {
  visible: boolean;
  title: string;
  hint?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  saving?: boolean;
  onClose: () => void;
  onSave: () => void;
};

export default function ProfileEditBottomSheet({
  visible,
  title,
  hint,
  value,
  onChangeText,
  placeholder,
  saving = false,
  onClose,
  onSave,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <View style={styles.overlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
          />
          <View
            style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}
            accessibilityViewIsModal
          >
            <View style={styles.grabberWrap}>
              <View style={styles.grabber} />
            </View>

            <View style={styles.headerRow}>
              <Pressable
                onPress={onClose}
                disabled={saving}
                hitSlop={10}
                style={styles.headerAction}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
              <Pressable
                onPress={onSave}
                disabled={saving}
                hitSlop={10}
                style={styles.headerAction}
              >
                {saving ? (
                  <ActivityIndicator color={NAVY} size="small" />
                ) : (
                  <Text style={styles.saveText}>Save</Text>
                )}
              </Pressable>
            </View>

            {hint ? <Text style={styles.hint}>{hint}</Text> : null}

            <TextInput
              style={styles.input}
              value={value}
              onChangeText={onChangeText}
              placeholder={placeholder}
              placeholderTextColor="#9AA1B5"
              multiline
              scrollEnabled
              showsVerticalScrollIndicator={false}
              textAlignVertical="top"
              autoFocus
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 4,
    maxHeight: '88%',
    minHeight: 280,
    borderTopWidth: 1,
    borderColor: '#E8ECF4',
  },
  grabberWrap: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  headerAction: {
    minWidth: 64,
    paddingVertical: 6,
  },
  title: {
    flex: 1,
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    color: NAVY,
    textAlign: 'center',
  },
  cancelText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: '#6B7280',
  },
  saveText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: NAVY,
    textAlign: 'right',
  },
  hint: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  input: {
    flex: 1,
    minHeight: 140,
    maxHeight: 320,
    borderWidth: 1,
    borderColor: '#D6DBF0',
    borderRadius: 10,
    padding: 12,
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: NAVY,
    marginBottom: 8,
  },
});
