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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

const TEXT_ACCENT = '#202871';
const SUBTITLE_COLOR = '#798AA3';
const INPUT_BORDER = '#202871';
const INPUT_FILL = '#F4F6F9';
const PLACEHOLDER_GREY = '#9CA3AF';
const CONTINUE_NAVY = '#202871';

const FONT = {
  poppinsReg: 'Poppins_400Regular',
  poppinsMed: 'Poppins_500Medium',
} as const;

type RootParamList = {
  NewPassword: { email?: string } | undefined;
  PasswordUpdated: undefined;
  Login: undefined;
};

type Props = NativeStackScreenProps<RootParamList, 'NewPassword'>;

const MIN_LEN = 8;

export default function NewPasswordScreen({ navigation }: Props) {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
  });

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  if (!fontsLoaded) {
    return (
      <View style={styles.fontSplash}>
        <ActivityIndicator color={CONTINUE_NAVY} size="large" />
      </View>
    );
  }

  const onContinue = () => {
    if (password.length < MIN_LEN) {
      Alert.alert('Password', `Use at least ${MIN_LEN} characters.`);
      return;
    }
    if (password !== confirm) {
      Alert.alert('Password', 'Passwords do not match.');
      return;
    }
    navigation.replace('PasswordUpdated');
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
          overScrollMode="never"
        >
          <Text style={styles.title}>New Password</Text>
          <Text style={styles.subtitle}>
            Enter a new password for your account.
          </Text>

          <View style={styles.formBlock}>
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
              >
                <MaterialCommunityIcons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={22}
                  color={INPUT_BORDER}
                />
              </Pressable>
            </View>

            <Text style={[styles.fieldLabel, styles.labelSecond]}>Confirm Password</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.inputInner}
                placeholder="at least 8 characters"
                placeholderTextColor={PLACEHOLDER_GREY}
                secureTextEntry={!showConfirm}
                value={confirm}
                onChangeText={setConfirm}
              />
              <Pressable
                onPress={() => setShowConfirm((s) => !s)}
                hitSlop={12}
                accessibilityRole="button"
              >
                <MaterialCommunityIcons
                  name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                  size={22}
                  color={INPUT_BORDER}
                />
              </Pressable>
            </View>
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
  title: {
    fontFamily: FONT.poppinsMed,
    fontSize: 24,
    color: TEXT_ACCENT,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: FONT.poppinsReg,
    fontSize: 14,
    lineHeight: 20,
    color: SUBTITLE_COLOR,
    textAlign: 'center',
    marginBottom: 28,
  },
  formBlock: {
    width: 320,
    maxWidth: '100%',
    alignSelf: 'center',
    marginBottom: 28,
  },
  fieldLabel: {
    fontFamily: FONT.poppinsMed,
    fontSize: 14,
    color: TEXT_ACCENT,
    marginBottom: 8,
  },
  labelSecond: {
    marginTop: 14,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    borderWidth: 2,
    borderColor: INPUT_BORDER,
    borderRadius: 8,
    backgroundColor: INPUT_FILL,
    paddingLeft: 14,
    paddingRight: 12,
    gap: 12,
  },
  inputInner: {
    flex: 1,
    fontFamily: FONT.poppinsReg,
    fontSize: 14,
    color: TEXT_ACCENT,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    minHeight: 44,
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
  continueBtnText: {
    fontFamily: FONT.poppinsReg,
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});
