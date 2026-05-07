import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
} from '@expo-google-fonts/poppins';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

const TEXT_ACCENT = '#202871';
const SUBTITLE_COLOR = '#798AA3';
const INPUT_BORDER = '#C9D2E0';
const PLACEHOLDER_GREY = '#9CA3AF';
const CONTINUE_NAVY = '#202871';

const FONT = {
  poppinsReg: 'Poppins_400Regular',
  poppinsMed: 'Poppins_500Medium',
} as const;

type RootParamList = {
  Onboarding: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  CodeSent: { email?: string } | undefined;
  Verification: { email?: string; flow: 'register' | 'reset' } | undefined;
  RegistrationSuccess: undefined;
  MainTabs: undefined;
};

type Props = NativeStackScreenProps<RootParamList, 'ForgotPassword'>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
  });

  const [email, setEmail] = useState('');

  if (!fontsLoaded) {
    return (
      <View style={styles.fontSplash}>
        <ActivityIndicator color={CONTINUE_NAVY} size="large" />
      </View>
    );
  }

  const isValid = EMAIL_RE.test(email.trim());

  const onContinue = () => {
    if (!isValid) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }
    navigation.replace('CodeSent', { email: email.trim() });
  };

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

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
          alwaysBounceVertical={false}
          overScrollMode="never"
        >
          <Text style={styles.title}>Forgot Password</Text>
          <Text style={styles.subtitle}>Enter your email.</Text>

          <View style={styles.formBlock}>
            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="example@email.com"
              placeholderTextColor={PLACEHOLDER_GREY}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
              returnKeyType="done"
              onSubmitEditing={onContinue}
            />
          </View>

          <TouchableOpacity
            style={styles.continueBtn}
            onPress={onContinue}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Continue"
          >
            <Text style={styles.continueBtnText}>Continue</Text>
          </TouchableOpacity>
        </ScrollView>
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 36,
    alignItems: 'center',
  },
  /** Forgot Password — Poppins Medium 24 · #202871 */
  title: {
    fontFamily: FONT.poppinsMed,
    fontSize: 24,
    color: TEXT_ACCENT,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  /** Enter your email. — Poppins Regular 14 · #798AA3 */
  subtitle: {
    fontFamily: FONT.poppinsReg,
    fontSize: 14,
    lineHeight: 20,
    color: SUBTITLE_COLOR,
    textAlign: 'center',
    marginBottom: 36,
  },
  formBlock: {
    width: 320,
    maxWidth: '100%',
    alignSelf: 'center',
    marginBottom: 28,
  },
  /** Email — Poppins Medium 14 · #202871 */
  fieldLabel: {
    fontFamily: FONT.poppinsMed,
    fontSize: 14,
    color: TEXT_ACCENT,
    marginBottom: 10,
  },
  /** 320 x 48, radius 8, light grey border */
  input: {
    width: '100%',
    height: 48,
    borderWidth: 1,
    borderColor: INPUT_BORDER,
    borderRadius: 8,
    paddingHorizontal: 14,
    fontFamily: FONT.poppinsReg,
    fontSize: 14,
    color: TEXT_ACCENT,
    backgroundColor: '#FFFFFF',
  },
  continueBtn: {
    width: 320,
    maxWidth: '100%',
    alignSelf: 'center',
    backgroundColor: CONTINUE_NAVY,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  /** Continue — Poppins Regular 16 · white */
  continueBtnText: {
    fontFamily: FONT.poppinsReg,
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});
