import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  REPORT_REASON_OPTIONS,
  type ReportReasonCode,
} from '../../api/reportApi';

const NAVY = '#202871';
const MUTED = '#858BBD';
const BORDER = '#D6DAEA';
const CARD_BG = '#F7F8FE';
const PAGE_BG = '#FFFFFF';
const SUCCESS = '#16A34A';

type Props = {
  visible: boolean;
  jobTitle?: string;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    reasonCode: ReportReasonCode;
    details: string;
  }) => Promise<void> | void;
};

export default function ReportJobSheet({
  visible,
  jobTitle,
  submitting = false,
  onClose,
  onSubmit,
}: Props) {
  const insets = useSafeAreaInsets();
  const [reasonCode, setReasonCode] = useState<ReportReasonCode | null>(null);
  const [details, setDetails] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setReasonCode(null);
    setDetails('');
    setDone(false);
    setError(null);
  }, [visible]);

  const handleSubmit = async () => {
    if (!reasonCode || submitting) return;
    setError(null);
    try {
      await onSubmit({ reasonCode, details: details.trim() });
      setDone(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not submit report'
      );
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <SafeAreaView
          edges={['bottom']}
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          <View style={styles.handle} />

          {done ? (
            <View style={styles.successBlock}>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark-circle" size={40} color={SUCCESS} />
              </View>
              <Text style={styles.title}>Thanks — we’ll review</Text>
              <Text style={styles.subtitle}>
                Our safety team will look at this listing. You won’t need to
                report it again while it’s under review.
              </Text>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  pressed && { opacity: 0.88 },
                ]}
              >
                <Text style={styles.primaryBtnText}>Done</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.headerRow}>
                <View style={styles.headerTextCol}>
                  <Text style={styles.title}>Report this job</Text>
                  <Text style={styles.subtitle}>
                    {jobTitle
                      ? `Tell us what’s wrong with “${jobTitle}”.`
                      : 'We’ll review this listing. False reports may be limited.'}
                  </Text>
                </View>
                <Pressable
                  onPress={onClose}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  style={({ pressed }) => [
                    styles.closeBtn,
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  <Ionicons name="close" size={22} color={NAVY} />
                </Pressable>
              </View>

              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollInner}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {REPORT_REASON_OPTIONS.map((opt) => {
                  const selected = reasonCode === opt.code;
                  return (
                    <Pressable
                      key={opt.code}
                      onPress={() => setReasonCode(opt.code)}
                      style={({ pressed }) => [
                        styles.optionRow,
                        selected && styles.optionRowSelected,
                        pressed && { opacity: 0.75 },
                      ]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                    >
                      <View
                        style={[
                          styles.radioOuter,
                          selected && styles.radioOuterSelected,
                        ]}
                      >
                        {selected ? <View style={styles.radioInner} /> : null}
                      </View>
                      <Text
                        style={[
                          styles.optionLabel,
                          selected && styles.optionLabelSelected,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}

                <Text style={styles.fieldLabel}>Details (optional)</Text>
                <TextInput
                  value={details}
                  onChangeText={setDetails}
                  placeholder="What happened?"
                  placeholderTextColor={MUTED}
                  multiline
                  maxLength={2000}
                  style={styles.detailsInput}
                  textAlignVertical="top"
                />

                {error ? <Text style={styles.errorText}>{error}</Text> : null}
              </ScrollView>

              <Pressable
                onPress={() => void handleSubmit()}
                disabled={!reasonCode || submitting}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  (!reasonCode || submitting) && styles.primaryBtnDisabled,
                  pressed && reasonCode && !submitting && { opacity: 0.88 },
                ]}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryBtnText}>Submit report</Text>
                )}
              </Pressable>
            </>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(18, 24, 58, 0.45)',
  },
  sheet: {
    backgroundColor: PAGE_BG,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: '88%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: BORDER,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 12,
  },
  headerTextCol: {
    flex: 1,
    minWidth: 0,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    color: NAVY,
    lineHeight: 24,
  },
  subtitle: {
    marginTop: 4,
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: MUTED,
    lineHeight: 18,
  },
  scroll: {
    maxHeight: 420,
  },
  scrollInner: {
    paddingBottom: 12,
    gap: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD_BG,
  },
  optionRowSelected: {
    borderColor: NAVY,
    backgroundColor: '#EEF0F8',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: MUTED,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: NAVY,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: NAVY,
  },
  optionLabel: {
    flex: 1,
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: NAVY,
  },
  optionLabelSelected: {
    fontFamily: 'Poppins_500Medium',
  },
  fieldLabel: {
    marginTop: 8,
    marginBottom: 4,
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: NAVY,
  },
  detailsInput: {
    minHeight: 96,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD_BG,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: NAVY,
  },
  errorText: {
    marginTop: 4,
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: '#DC2626',
  },
  primaryBtn: {
    marginTop: 8,
    height: 48,
    borderRadius: 12,
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.45,
  },
  primaryBtnText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  successBlock: {
    paddingBottom: 8,
    alignItems: 'center',
  },
  successIcon: {
    marginBottom: 8,
  },
});
