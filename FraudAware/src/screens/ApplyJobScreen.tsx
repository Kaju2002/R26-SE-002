import React, { useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
} from '@expo-google-fonts/poppins';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/rootStackParams';

const NAVY = '#202871';
const NAVY_DISABLED = '#A1A6CC';
const DEEP = '#42498A';
const MUTED = '#A8B9CA';
const BORDER = '#D6DAEA';
const PAGE_BG = '#FFFFFF';
const FIELD_BG = '#FFFFFF';
const PINK_BG = '#FDEDEE';
const RED = '#C62828';

const SUCCESS_TITLE = '#235C04';
const SUCCESS_BODY = '#449C0A';

type RouteParams = { ApplyJob: { jobId?: string } | undefined };

type Resume = { name: string; size: string };

type ApplyNav = NativeStackNavigationProp<RootStackParamList, 'ApplyJob'>;

export default function ApplyJobScreen() {
  const navigation = useNavigation<ApplyNav>();
  useRoute<RouteProp<RouteParams, 'ApplyJob'>>();

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
  });

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [resume, setResume] = useState<Resume | null>(null);
  const [motivation, setMotivation] = useState('');
  const [focused, setFocused] = useState<string | null>(null);
  const [successVisible, setSuccessVisible] = useState(false);

  if (!fontsLoaded) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={NAVY} size="large" />
      </View>
    );
  }

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const isValid =
    fullName.trim().length > 0 && emailValid && resume !== null;

  const handleUpload = () => {
    setResume({ name: 'Resume_MelvinKuffour.pdf', size: '543 Kb' });
  };

  const handleRemove = () => setResume(null);

  const handleSubmit = () => {
    if (!isValid) return;
    setSuccessVisible(true);
  };

  const handleGoToApplications = () => {
    setSuccessVisible(false);
    navigation.pop(2);
    navigation.navigate('Notifications', { initialTab: 'applications' });
  };

  const handleDismissSuccess = () => {
    setSuccessVisible(false);
  };

  const renderInput = ({
    id,
    label,
    placeholder,
    value,
    onChange,
    multiline,
    keyboardType,
    autoCapitalize,
  }: {
    id: string;
    label: string;
    placeholder: string;
    value: string;
    onChange: (t: string) => void;
    multiline?: boolean;
    keyboardType?: 'email-address' | 'default';
    autoCapitalize?: 'none' | 'sentences' | 'words';
  }) => (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          multiline && styles.inputMultiline,
          focused === id && styles.inputFocused,
        ]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={MUTED}
        onFocus={() => setFocused(id)}
        onBlur={() => setFocused(null)}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        autoCorrect={!multiline}
        underlineColorAndroid="transparent"
        selectionColor={NAVY}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => [
            styles.backBtn,
            pressed && { opacity: 0.6 },
          ]}
        >
          <Ionicons name="chevron-back" size={26} color={NAVY} />
        </Pressable>
        <Text style={styles.title}>Apply</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderInput({
            id: 'fullName',
            label: 'Full Name',
            placeholder: 'John Doe',
            value: fullName,
            onChange: setFullName,
            autoCapitalize: 'words',
          })}

          {renderInput({
            id: 'email',
            label: 'Email',
            placeholder: 'example@email.com',
            value: email,
            onChange: setEmail,
            keyboardType: 'email-address',
            autoCapitalize: 'none',
          })}

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Upload CV/Resume</Text>
            {resume ? (
              <View style={styles.resumeCard}>
                <View style={styles.pdfIcon}>
                  <Ionicons name="document-text" size={26} color={RED} />
                </View>
                <View style={styles.resumeMeta}>
                  <Text
                    style={styles.resumeName}
                    numberOfLines={1}
                  >
                    {resume.name}
                  </Text>
                  <Text style={styles.resumeSize}>{resume.size}</Text>
                </View>
                <Pressable
                  onPress={handleRemove}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Remove uploaded file"
                  style={({ pressed }) => [
                    styles.removeBtn,
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  <Ionicons name="close" size={22} color={RED} />
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={handleUpload}
                accessibilityRole="button"
                accessibilityLabel="Upload your CV"
                style={({ pressed }) => [
                  styles.uploadBox,
                  pressed && { opacity: 0.85, borderColor: NAVY },
                ]}
              >
                <Ionicons
                  name="document-attach-outline"
                  size={36}
                  color={MUTED}
                />
                <Text style={styles.uploadHint}>Upload file</Text>
              </Pressable>
            )}
          </View>

          {renderInput({
            id: 'motivation',
            label: 'Motivation Letter (Optional)',
            placeholder: 'Motivational letter',
            value: motivation,
            onChange: setMotivation,
            multiline: true,
          })}

          <View style={{ height: 12 }} />
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            onPress={handleSubmit}
            disabled={!isValid}
            accessibilityRole="button"
            accessibilityLabel="Submit application"
            accessibilityState={{ disabled: !isValid }}
            style={({ pressed }) => [
              styles.submitBtn,
              !isValid && styles.submitBtnDisabled,
              pressed && isValid && { opacity: 0.9 },
            ]}
          >
            <Text style={styles.submitText}>Submit</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={successVisible}
        transparent
        animationType="slide"
        onRequestClose={handleDismissSuccess}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={handleDismissSuccess}
            accessibilityLabel="Dismiss"
          />
          <SafeAreaView edges={['bottom']} style={styles.sheetOuter}>
            <View style={styles.sheet}>
              <View style={styles.sheetGrabber} />
              <View style={styles.successIconWrap}>
                <View style={styles.successRingOuter}>
                  <View style={styles.successRingMid}>
                    <View style={styles.successRingInner}>
                      <Ionicons name="checkmark" size={32} color="#FFFFFF" />
                    </View>
                  </View>
                </View>
              </View>
              <Text style={styles.successTitle}>Applied Successfully!</Text>
              <Text style={styles.successBody}>
                You have successfully applied for the job.{'\n\n'}
                You can track your application progress through{'\n'}
                the application menu.
              </Text>
              <Pressable
                onPress={handleGoToApplications}
                accessibilityRole="button"
                accessibilityLabel="Go to Applications"
                style={({ pressed }) => [
                  styles.goApplicationsBtn,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={styles.goApplicationsText}>
                  Go to Applications
                </Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const UPLOAD_HEIGHT = 135;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  splash: {
    flex: 1,
    backgroundColor: PAGE_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 12,
    gap: 4,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** "Apply" — Poppins Medium 18 · #202871 */
  title: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 18,
    color: NAVY,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 20,
  },
  fieldGroup: {
    marginBottom: 18,
    gap: 8,
  },
  /** Field label — Poppins Medium 14 · #202871 */
  fieldLabel: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: NAVY,
  },
  /** Input — Poppins Regular 14 · #202871 */
  input: {
    backgroundColor: FIELD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: NAVY,
    minHeight: 48,
  },
  inputFocused: {
    borderColor: NAVY,
    borderWidth: 1.5,
  },
  inputMultiline: {
    minHeight: 130,
    paddingTop: 12,
  },
  /** Upload empty state — 320 × 135 (responsive width) */
  uploadBox: {
    height: UPLOAD_HEIGHT,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: BORDER,
    borderRadius: 10,
    backgroundColor: '#F7F8FE',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  uploadHint: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: MUTED,
  },
  /** Upload filled state — light pink card */
  resumeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: PINK_BG,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F5C6CA',
    minHeight: 64,
  },
  pdfIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumeMeta: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  resumeName: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: DEEP,
  },
  resumeSize: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: MUTED,
  },
  removeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** ----- FOOTER ----- */
  footer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 18,
    backgroundColor: PAGE_BG,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  submitBtn: {
    backgroundColor: NAVY,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: NAVY_DISABLED,
  },
  /** Submit — Poppins Medium 16 · #FFFFFF */
  submitText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  /** ----- SUCCESS BOTTOM SHEET ----- */
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  sheetOuter: {
    backgroundColor: 'transparent',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 16,
  },
  sheetGrabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EE',
    marginBottom: 20,
  },
  successIconWrap: {
    marginBottom: 18,
  },
  successRingOuter: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#E8F6EE',
    borderWidth: 3,
    borderColor: '#B8E0C8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successRingMid: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#C8E6C9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successRingInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: SUCCESS_BODY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Applied Successfully! — Poppins Medium 20 · #235C04 */
  successTitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 20,
    color: SUCCESS_TITLE,
    textAlign: 'center',
    marginBottom: 12,
  },
  /** Body — Poppins Regular 14 · #449C0A */
  successBody: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: SUCCESS_BODY,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  goApplicationsBtn: {
    alignSelf: 'stretch',
    backgroundColor: NAVY,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Go to Applications — Poppins Regular 16 · #FFFFFF */
  goApplicationsText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});
