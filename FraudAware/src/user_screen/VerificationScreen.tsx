import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFonts } from '@expo-google-fonts/poppins';
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
} from '@expo-google-fonts/poppins';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

const TEXT_ACCENT = '#202871';
const SUBTLE_TEXT = '#6B7280';
const BOX_BORDER = '#202871';
const BOX_BORDER_IDLE = '#D1D5DB';
const BOX_FILL_FOCUSED = '#FFFFFF';

const FONT = {
  poppinsReg: 'Poppins_400Regular',
  poppinsMed: 'Poppins_500Medium',
  poppinsSemi: 'Poppins_600SemiBold',
} as const;

const OTP_LENGTH = 6;
const RESEND_SECONDS = 27;

type RootParamList = {
  Onboarding: undefined;
  Login: undefined;
  Register: undefined;
  Verification: { email?: string } | undefined;
  RegistrationSuccess: undefined;
  MainTabs: undefined;
};

type Props = NativeStackScreenProps<RootParamList, 'Verification'>;

function formatTime(total: number): string {
  const m = Math.floor(total / 60).toString().padStart(2, '0');
  const s = (total % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function VerificationScreen({ navigation, route }: Props) {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
  });

  const email = route?.params?.email;

  const [digits, setDigits] = useState<string[]>(() =>
    Array(OTP_LENGTH).fill('')
  );
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [seconds, setSeconds] = useState<number>(RESEND_SECONDS);

  const inputRefs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    if (seconds <= 0) return;
    const id = setInterval(() => {
      setSeconds((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [seconds]);

  const code = useMemo(() => digits.join(''), [digits]);
  const isComplete = code.length === OTP_LENGTH && digits.every((d) => d !== '');

  const handleChange = (raw: string, index: number) => {
    const cleaned = raw.replace(/\D/g, '');

    if (cleaned.length > 1) {
      const next = [...digits];
      for (let i = 0; i < OTP_LENGTH; i += 1) {
        const c = cleaned[i];
        if (c !== undefined) next[i] = c;
      }
      setDigits(next);
      const lastFilled = Math.min(cleaned.length, OTP_LENGTH) - 1;
      const focusTarget = Math.min(lastFilled + 1, OTP_LENGTH - 1);
      inputRefs.current[focusTarget]?.focus();
      return;
    }

    const next = [...digits];
    next[index] = cleaned;
    setDigits(next);

    if (cleaned && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (
    e: { nativeEvent: { key: string } },
    index: number
  ) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const next = [...digits];
      next[index - 1] = '';
      setDigits(next);
    }
  };

  const onResend = () => {
    if (seconds > 0) return;
    setDigits(Array(OTP_LENGTH).fill(''));
    setSeconds(RESEND_SECONDS);
    inputRefs.current[0]?.focus();
    Alert.alert('Code Sent', `A new verification code has been sent${email ? ` to ${email}` : ''}.`);
  };

  const onVerify = () => {
    if (!isComplete) {
      Alert.alert('Incomplete code', 'Please enter all 6 digits.');
      return;
    }
    inputRefs.current.forEach((r) => r?.blur());
    navigation.replace('RegistrationSuccess');
  };

  if (!fontsLoaded) {
    return (
      <View style={styles.fontSplash}>
        <ActivityIndicator color={TEXT_ACCENT} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={16}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="chevron-back" size={28} color={TEXT_ACCENT} />
          </Pressable>
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>Verification Code</Text>
          <Text style={styles.subtitle}>
            A verification code has been sent to{'\n'}your email.
          </Text>

          <View style={styles.otpRow}>
            {digits.map((d, i) => {
              const isFocused = focusedIndex === i;
              const hasValue = d !== '';
              return (
                <TextInput
                  key={i}
                  ref={(r) => {
                    inputRefs.current[i] = r;
                  }}
                  value={d}
                  onChangeText={(t) => handleChange(t, i)}
                  onKeyPress={(e) => handleKeyPress(e, i)}
                  onFocus={() => setFocusedIndex(i)}
                  keyboardType="number-pad"
                  maxLength={OTP_LENGTH}
                  textContentType="oneTimeCode"
                  autoComplete={Platform.OS === 'ios' ? 'one-time-code' : 'sms-otp'}
                  selectionColor={TEXT_ACCENT}
                  style={[
                    styles.otpBox,
                    (hasValue || isFocused) && styles.otpBoxActive,
                    isFocused && !hasValue && styles.otpBoxFocusedEmpty,
                  ]}
                  accessibilityLabel={`Digit ${i + 1}`}
                />
              );
            })}
          </View>

          <View style={styles.timerRow}>
            <Text style={styles.timerText}>{formatTime(seconds)}</Text>
            <TouchableOpacity
              onPress={onResend}
              disabled={seconds > 0}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.resendText,
                  seconds > 0 && styles.resendDisabled,
                ]}
              >
                Resend Code
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.verifyBtn, !isComplete && styles.verifyBtnDisabled]}
            onPress={onVerify}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Verify"
          >
            <Text style={styles.verifyBtnText}>Verify</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fontSplash: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  safe: {
    flex: 1,
    backgroundColor: '#fff',
  },
  flex: {
    flex: 1,
  },
  headerRow: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 28,
    alignItems: 'center',
  },
  /** Verification Code — Poppins SemiBold 24 · #202871 */
  title: {
    fontFamily: FONT.poppinsSemi,
    fontSize: 24,
    color: TEXT_ACCENT,
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  /** Subtitle — Poppins Regular 14 · muted */
  subtitle: {
    fontFamily: FONT.poppinsReg,
    fontSize: 14,
    lineHeight: 20,
    color: SUBTLE_TEXT,
    textAlign: 'center',
    marginBottom: 36,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    marginBottom: 20,
    gap: 8,
  },
  /** 48x56 box, radius 8, idle border #D1D5DB */
  otpBox: {
    flex: 1,
    aspectRatio: 0.86,
    maxWidth: 52,
    minHeight: 56,
    borderWidth: 1.5,
    borderColor: BOX_BORDER_IDLE,
    borderRadius: 10,
    backgroundColor: '#fff',
    textAlign: 'center',
    fontFamily: FONT.poppinsSemi,
    fontSize: 22,
    color: TEXT_ACCENT,
    paddingVertical: 0,
  },
  /** Filled box — solid navy fill, white text, like Figma */
  otpBoxActive: {
    backgroundColor: TEXT_ACCENT,
    borderColor: TEXT_ACCENT,
    color: '#FFFFFF',
  },
  /** Currently-focused empty box — navy outline, white fill */
  otpBoxFocusedEmpty: {
    backgroundColor: BOX_FILL_FOCUSED,
    borderColor: BOX_BORDER,
    color: TEXT_ACCENT,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    marginBottom: 32,
  },
  /** Countdown — Poppins Regular 14 · muted */
  timerText: {
    fontFamily: FONT.poppinsReg,
    fontSize: 14,
    color: SUBTLE_TEXT,
  },
  /** Resend Code — Poppins Medium 14 · #202871 */
  resendText: {
    fontFamily: FONT.poppinsMed,
    fontSize: 14,
    color: TEXT_ACCENT,
  },
  resendDisabled: {
    opacity: 0.45,
  },
  verifyBtn: {
    alignSelf: 'stretch',
    backgroundColor: TEXT_ACCENT,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  verifyBtnDisabled: {
    opacity: 0.7,
  },
  /** Verify — Poppins Medium 16 · white */
  verifyBtnText: {
    fontFamily: FONT.poppinsMed,
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});
