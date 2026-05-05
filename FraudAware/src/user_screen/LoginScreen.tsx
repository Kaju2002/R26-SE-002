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

/** Brand navy — CareerPathway title only */
const BRAND_NAVY = '#1F2A90';
/** Text & headline accent */
const TEXT_ACCENT = '#202871';
const SIGN_IN_BTN = '#202871';
const PERI = '#838BD2';
const PLACEHOLDER_GREY = '#9CA3AF';
const DIVIDER_GREY = '#D1D5DB';
const GOOGLE_TEXT = '#374151';

const FONT = {
  robotoMedium: 'Roboto_500Medium',
  poppinsReg: 'Poppins_400Regular',
  poppinsMed: 'Poppins_500Medium',
} as const;

type Props = NativeStackScreenProps<
  { Login: undefined; Register: undefined; MainTabs: undefined },
  'Login'
>;

export default function LoginScreen({ navigation }: Props) {
  const [fontsLoaded] = useFonts({
    Roboto_500Medium,
    Poppins_400Regular,
    Poppins_500Medium,
  });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const onSignIn = () => {
    navigation.replace('MainTabs');
  };

  if (!fontsLoaded) {
    return (
      <View style={styles.fontSplash}>
        <ActivityIndicator color={SIGN_IN_BTN} size="large" />
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
          <Image
            source={require('../../assets/icons/Group1.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="CareerPathway logo"
          />

          <Text style={styles.appName}>CareerPathway</Text>
          <Text style={styles.headline}>Welcome Back!</Text>

          <Text style={styles.fieldLabel}>Email</Text>
          <View style={styles.inputShell}>
            <TextInput
              style={styles.input}
              placeholder="example@gmail.com"
              placeholderTextColor={PLACEHOLDER_GREY}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
            />
            <MaterialCommunityIcons name="eye-outline" size={22} color={PERI} style={styles.inputTrailIcon} />
          </View>

          <Text style={styles.fieldLabel}>Password</Text>
          <View style={styles.inputShell}>
            <TextInput
              style={styles.input}
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
                color={PERI}
              />
            </Pressable>
          </View>

          <TouchableOpacity
            style={styles.forgotWrap}
            onPress={() => Alert.alert('Forgot password', 'Reset link flow can be added here.')}
            accessibilityRole="button"
          >
            <Text style={styles.forgotText}>Forgot your password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.signInBtn}
            onPress={onSignIn}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Sign in"
          >
            <Text style={styles.signInBtnText}>Sign In</Text>
          </TouchableOpacity>

          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>OR</Text>
            <View style={styles.orLine} />
          </View>

          <TouchableOpacity
            style={styles.googleBtn}
            onPress={() => Alert.alert('Google', 'Sign in with Google coming soon.')}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <Image
              source={require('../../assets/icons/logo googleg 48dp.png')}
              style={styles.googleIcon}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
            <Text style={styles.googleBtnText}>Sign in with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.appleBtn}
            onPress={() => Alert.alert('Apple', 'Sign in with Apple coming soon.')}
            activeOpacity={0.85}
            accessibilityRole="button"
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
            <Text style={styles.footerMuted}>{"Don't have an account? "}</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Register')}
              accessibilityRole="link"
            >
              <Text style={styles.registerLink}>Register</Text>
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
    paddingTop: 16,
    paddingBottom: 36,
    alignItems: 'center',
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 12,
  },
  /** CareerPathway — Roboto Medium 20 · #1F2A90 */
  appName: {
    fontFamily: FONT.robotoMedium,
    fontSize: 20,
    color: BRAND_NAVY,
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  /** Welcome Back — Poppins Medium 24 · #202871 */
  headline: {
    fontFamily: FONT.poppinsMed,
    fontSize: 24,
    color: TEXT_ACCENT,
    marginBottom: 24,
    letterSpacing: -0.3,
  },
  /** Email / Password labels — Poppins Medium 14 · #202871 */
  fieldLabel: {
    alignSelf: 'stretch',
    fontFamily: FONT.poppinsMed,
    fontSize: 14,
    color: TEXT_ACCENT,
    marginBottom: 8,
  },
  inputShell: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: PERI,
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 50,
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  /** Input + placeholders — Poppins Regular 14 */
  input: {
    flex: 1,
    fontFamily: FONT.poppinsReg,
    fontSize: 14,
    color: TEXT_ACCENT,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
  },
  inputTrailIcon: {
    marginLeft: 8,
  },
  forgotWrap: {
    alignSelf: 'center',
    marginBottom: 20,
  },
  /** Forgot password — Poppins Regular 14 · #202871 */
  forgotText: {
    fontFamily: FONT.poppinsReg,
    fontSize: 14,
    color: TEXT_ACCENT,
  },
  signInBtn: {
    alignSelf: 'stretch',
    backgroundColor: SIGN_IN_BTN,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Sign In — Poppins Regular 14 (on button) */
  signInBtnText: {
    fontFamily: FONT.poppinsReg,
    fontSize: 14,
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
  /** OR — Poppins Regular 14 */
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
  /** Sign in with Google — Roboto Medium 14 */
  googleBtnText: {
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
  /** Sign in with Apple — Roboto Medium 14 */
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
  /** Don’t have… — Poppins Regular 14 */
  footerMuted: {
    fontFamily: FONT.poppinsReg,
    fontSize: 14,
    color: TEXT_ACCENT,
  },
  /** Register — Poppins Medium 14 */
  registerLink: {
    fontFamily: FONT.poppinsMed,
    fontSize: 14,
    color: TEXT_ACCENT,
    textDecorationLine: 'underline',
  },
});
