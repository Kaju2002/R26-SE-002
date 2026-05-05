import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { useFonts, Roboto_500Medium } from '@expo-google-fonts/roboto';
import { Poppins_400Regular, Poppins_500Medium } from '@expo-google-fonts/poppins';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

const TEXT_ACCENT = '#202871';
const REGISTER_BTN = '#202871';
/** Figma Primary/50 stroke */
const INPUT_BORDER = '#202871';
/** Figma Neutral/20 fill */
const INPUT_FILL = '#F4F6F9';
const PLACEHOLDER_GREY = '#9CA3AF';
const DIVIDER_GREY = '#D1D5DB';
const GOOGLE_TEXT = '#374151';

const FONT = {
  robotoMedium: 'Roboto_500Medium',
  poppinsReg: 'Poppins_400Regular',
  poppinsMed: 'Poppins_500Medium',
} as const;

type RootParamList = {
  Onboarding: undefined;
  Login: undefined;
  Register: undefined;
  MainTabs: undefined;
};

type Props = NativeStackScreenProps<RootParamList, 'Register'>;

export default function RegisterScreen({ navigation }: Props) {
  const [fontsLoaded] = useFonts({
    Roboto_500Medium,
    Poppins_400Regular,
    Poppins_500Medium,
  });

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const onRegister = () => {
    navigation.replace('MainTabs');
  };

  if (!fontsLoaded) {
    return (
      <View style={styles.fontSplash}>
        <ActivityIndicator color={REGISTER_BTN} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
          alwaysBounceVertical={false}
          overScrollMode="never"
        >
          <Text style={styles.title}>Create an account</Text>

          <Text style={styles.fieldLabel}>Full Name</Text>
          <TextInput
            style={styles.inputFull}
            placeholder="John Doe"
            placeholderTextColor={PLACEHOLDER_GREY}
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
          />

          <Text style={styles.fieldLabel}>Email</Text>
          <TextInput
            style={styles.inputFull}
            placeholder="example@email.com"
            placeholderTextColor={PLACEHOLDER_GREY}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
          />

          <Text style={styles.fieldLabel}>Password</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.inputInner}
              placeholder="at least 8 characters"
              placeholderTextColor={PLACEHOLDER_GREY}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <Pressable
              onPress={() => setShowPassword((s) => !s)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            >
              <MaterialCommunityIcons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color={INPUT_BORDER}
              />
            </Pressable>
          </View>

          <Text style={styles.fieldLabel}>Confirm Password</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.inputInner}
              placeholder="at least 8 characters"
              placeholderTextColor={PLACEHOLDER_GREY}
              secureTextEntry={!showConfirm}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            <Pressable
              onPress={() => setShowConfirm((s) => !s)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
            >
              <MaterialCommunityIcons
                name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color={INPUT_BORDER}
              />
            </Pressable>
          </View>

          <TouchableOpacity
            style={styles.registerBtn}
            onPress={onRegister}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Register"
          >
            <Text style={styles.registerBtnText}>Register</Text>
          </TouchableOpacity>

          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>OR</Text>
            <View style={styles.orLine} />
          </View>

          <TouchableOpacity
            style={styles.googleBtn}
            onPress={() => Alert.alert('Google', 'Sign up with Google coming soon.')}
            activeOpacity={0.8}
          >
            <Image
              source={require('../../assets/icons/logo googleg 48dp.png')}
              style={styles.googleIcon}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
            <Text style={styles.socialBtnText}>Sign in with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.appleBtn}
            onPress={() => Alert.alert('Apple', 'Sign up with Apple coming soon.')}
            activeOpacity={0.85}
          >
            <Image
              source={require('../../assets/icons/Apple.png')}
              style={styles.appleIcon}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
            <Text style={styles.appleBtnText}>Sign in with Apple</Text>
          </TouchableOpacity>

          <View style={styles.footerRow}>
            <Text style={styles.footerMuted}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')} accessibilityRole="link">
              <Text style={styles.signInLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 36,
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  /** Create an account — Poppins Medium 24 · #202871 */
  title: {
    fontFamily: FONT.poppinsMed,
    fontSize: 24,
    color: TEXT_ACCENT,
    textAlign: 'center',
    marginBottom: 24,
    letterSpacing: -0.3,
  },
  /** Field labels — Poppins Medium 14 · #202871 */
  fieldLabel: {
    alignSelf: 'stretch',
    fontFamily: FONT.poppinsMed,
    fontSize: 14,
    color: TEXT_ACCENT,
    marginBottom: 8,
    marginTop: 2,
  },
  /** Figma: H 48, radius 8, stroke 2 inside, Neutral/20 fill */
  inputFull: {
    alignSelf: 'stretch',
    minHeight: 48,
    borderWidth: 2,
    borderColor: INPUT_BORDER,
    borderRadius: 8,
    backgroundColor: INPUT_FILL,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 11 : 9,
    fontFamily: FONT.poppinsReg,
    fontSize: 14,
    color: TEXT_ACCENT,
    marginBottom: 6,
  },
  inputRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    borderWidth: 2,
    borderColor: INPUT_BORDER,
    borderRadius: 8,
    backgroundColor: INPUT_FILL,
    paddingLeft: 16,
    paddingRight: 12,
    gap: 16,
    marginBottom: 6,
  },
  inputInner: {
    flex: 1,
    fontFamily: FONT.poppinsReg,
    fontSize: 14,
    color: TEXT_ACCENT,
    paddingVertical: Platform.OS === 'ios' ? 11 : 9,
    minHeight: 44,
  },
  /** Register — Poppins Regular 16 on #202871 */
  registerBtn: {
    alignSelf: 'stretch',
    backgroundColor: REGISTER_BTN,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 4,
  },
  registerBtnText: {
    fontFamily: FONT.poppinsReg,
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginVertical: 22,
    gap: 14,
  },
  orLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: DIVIDER_GREY,
  },
  orText: {
    fontFamily: FONT.poppinsReg,
    fontSize: 14,
    color: PLACEHOLDER_GREY,
  },
  googleBtn: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: DIVIDER_GREY,
    paddingVertical: 14,
    marginBottom: 14,
  },
  googleIcon: {
    width: 24,
    height: 24,
  },
  /** Roboto Medium 14 */
  socialBtnText: {
    fontFamily: FONT.robotoMedium,
    fontSize: 14,
    color: GOOGLE_TEXT,
  },
  appleBtn: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#000',
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 28,
  },
  appleIcon: {
    width: 24,
    height: 24,
  },
  appleBtnText: {
    fontFamily: FONT.robotoMedium,
    fontSize: 14,
    color: '#FFFFFF',
  },
  footerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
  /** Poppins Regular 14 */
  footerMuted: {
    fontFamily: FONT.poppinsReg,
    fontSize: 14,
    color: TEXT_ACCENT,
  },
  /** Match login “Register” link */
  signInLink: {
    fontFamily: FONT.poppinsMed,
    fontSize: 14,
    color: TEXT_ACCENT,
    textDecorationLine: 'underline',
  },
});
