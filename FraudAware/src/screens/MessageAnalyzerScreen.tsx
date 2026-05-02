import React, { useCallback, useState } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import type { DetectStackParamList } from '../navigation/detectStackTypes';
import { MESSAGE_CLASSIFY_URL } from '../config/messageAnalyzerApi';
import RecentScansList, { type RecentScanItem } from '../components/RecentScansList';

type Props = NativeStackScreenProps<DetectStackParamList, 'MessageAnalyzer'>;

const PRIMARY_RED = '#E53535';
const BUTTON_NAVY = '#202871';
const GREY_TEXT = '#6B7280';
const GREY_BORDER = '#C8CED6';
const MAX_CHARS = 2000;

const RECENT_SCANS: RecentScanItem[] = [
  {
    id: '1',
    status: 'scam' as const,
    title: 'SCAM — tactics',
    preview: 'URGENT: Wire $500 for background check before we can send your offer letter...',
    timeAgo: '2h ago',
    confidence: 94,
    tactics: [
      { name: 'Pressure for upfront payment', example: '...Wire $500 for background check...' },
      { name: 'Artificial urgency', example: '...URGENT...' },
    ],
    warning:
      'Legitimate employers rarely ask for payments before a verified offer. Do not send money or gift cards.',
    originalText:
      'URGENT: Wire $500 for background check before we can send your offer letter. Failure to pay within 24 hours will cancel your application.',
  },
  {
    id: '2',
    status: 'legit' as const,
    title: 'LEGITIMATE',
    preview: 'Hi, thanks for applying. We’d like to schedule a short call next week to discuss…',
    timeAgo: '1d ago',
    confidence: 87,
    reassurance:
      'No strong scam signals detected. Still verify the sender domain and interview details independently.',
    originalText:
      'Hi, thanks for applying. We’d like to schedule a short call next week to discuss your background and next steps. You’ll receive a calendar invite from recruiting@company.com.',
  },
  {
    id: '3',
    status: 'scam' as const,
    title: 'SCAM — fake urgency',
    preview: 'Final reminder: pay today or your interview slot will be canceled immediately...',
    timeAgo: '2d ago',
    confidence: 91,
    tactics: [{ name: 'Deadline pressure', example: '...pay today or slot canceled...' }],
    warning: 'Be wary of threats tied to interview slots. Confirm through official company channels only.',
    originalText:
      'Final reminder: pay today or your interview slot will be canceled immediately. Other candidates are waiting.',
  },
  {
    id: '4',
    status: 'legit' as const,
    title: 'LEGITIMATE',
    preview: 'Please join the official Zoom panel interview from our company domain email invite.',
    timeAgo: '3d ago',
    confidence: 82,
    reassurance: 'Communication references official channels. Continue to validate meeting links before joining.',
    originalText:
      'Please join the official Zoom panel interview using the link in the calendar invite from hr@company.com.',
  },
  {
    id: '5',
    status: 'scam' as const,
    title: 'SCAM — advance fee',
    preview: 'Kindly send processing fee through gift cards before onboarding confirmation.',
    timeAgo: '4d ago',
    confidence: 96,
    tactics: [{ name: 'Untraceable payment', example: '...gift cards...' }],
    warning: 'Gift cards are a common scam payment method. Never purchase cards to “secure” a job.',
    originalText:
      'Kindly send processing fee through gift cards before onboarding confirmation. Send codes by reply.',
  },
  {
    id: '6',
    status: 'legit' as const,
    title: 'LEGITIMATE',
    preview: 'Our recruiter will contact you from hr@company.com with next interview details.',
    timeAgo: '6d ago',
    confidence: 85,
    reassurance: 'Sender aligns with a corporate domain pattern. Still confirm the domain matches the careers site.',
    originalText:
      'Our recruiter will contact you from hr@company.com with next interview details and preparation materials.',
  },
];

export default function MessageAnalyzerScreen({ navigation }: Props) {
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(false);

  const onAnalyze = useCallback(async () => {
    const text = messageText.trim();
    if (!text.length) {
      Alert.alert('Missing message', 'Please paste a message to analyze.');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(MESSAGE_CLASSIFY_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = (await response.json()) as Record<string, unknown>;
      navigation.navigate('ResultScreen', {
        result: data,
        pastedMessage: text,
      });
    } catch {
      Alert.alert('Connection Error', 'Could not reach server');
    } finally {
      setLoading(false);
    }
  }, [messageText, navigation]);

  const onUploadScreenshot = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to upload a screenshot.');
      return;
    }
    const pick = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: false,
    });
    if (pick.canceled || !pick.assets?.[0]?.uri) {
      return;
    }
    navigation.navigate('ResultScreen', {
      imageUri: pick.assets[0].uri,
      isImage: true,
    });
  }, [navigation]);

  const onHowThisWorks = useCallback(() => {
    Alert.alert(
      'How this works',
      'We look for common scam signals in recruiter messages:\n\n- Urgency pressure\n- Requests for payments\n- Requests for sensitive details\n- Suspicious links or off-platform moves'
    );
  }, []);

  const len = messageText.length;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerSide}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <MaterialIcons name="arrow-back" size={24} color={BUTTON_NAVY} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Message Analyzer</Text>
          </View>
          <View style={[styles.headerSide, styles.headerSideRight]}>
            <View style={styles.shieldBadge}>
              <MaterialCommunityIcons name="shield-outline" size={18} color={PRIMARY_RED} />
            </View>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.infoBanner}>
            <MaterialIcons name="warning" size={22} color={PRIMARY_RED} style={styles.bannerIcon} />
            <View style={styles.bannerContent}>
              <Text style={styles.bannerText}>
                FraudAware checks recruiter messages for common scam signals so you can respond safely.
              </Text>
              <TouchableOpacity onPress={onHowThisWorks} activeOpacity={0.75}>
                <Text style={styles.bannerLink}>How this works</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.sectionLabel}>PASTE MESSAGE</Text>

          <View style={styles.inputShell}>
            <TextInput
              style={styles.textInput}
              multiline
              placeholder="Paste your WhatsApp, Telegram, or SMS message here…"
              placeholderTextColor={GREY_TEXT}
              value={messageText}
              onChangeText={(t) => setMessageText(t.slice(0, MAX_CHARS))}
              textAlignVertical="top"
            />
            <Text style={styles.charCounter}>
              {len} / {MAX_CHARS}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
            onPress={onAnalyze}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={PRIMARY_RED} />
            ) : (
              <>
                <MaterialIcons name="search" size={20} color="#fff" style={styles.btnIcon} />
                <Text style={styles.primaryBtnLabel}>Analyze Message</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or upload screenshot</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.outlineBtn}
            onPress={onUploadScreenshot}
            activeOpacity={0.85}
            disabled={loading}
          >
            <MaterialCommunityIcons name="image-outline" size={22} color={BUTTON_NAVY} style={styles.btnIcon} />
            <Text style={styles.outlineBtnLabel}>Upload Chat Screenshot</Text>
          </TouchableOpacity>

          <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>RECENT SCANS</Text>
          <RecentScansList scans={RECENT_SCANS} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E8E8',
    backgroundColor: '#fff',
  },
  headerSide: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingLeft: 4,
  },
  headerSideRight: {
    alignItems: 'flex-end',
    paddingRight: 4,
    paddingLeft: 0,
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: BUTTON_NAVY,
  },
  shieldBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(229, 53, 53, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FDECEC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(229, 53, 53, 0.35)',
    padding: 14,
    marginBottom: 22,
    gap: 10,
  },
  bannerIcon: {
    marginTop: 2,
  },
  bannerContent: {
    flex: 1,
  },
  bannerText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#5C2A2A',
    fontWeight: '500',
    marginBottom: 6,
  },
  bannerLink: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B22222',
    textDecorationLine: 'underline',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: GREY_TEXT,
    marginBottom: 8,
  },
  sectionLabelSpaced: {
    marginTop: 8,
    marginBottom: 12,
  },
  inputShell: {
    position: 'relative',
    marginBottom: 18,
  },
  textInput: {
    height: 120,
    borderWidth: 1.5,
    borderColor: GREY_BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 28,
    fontSize: 15,
    color: '#1a1a1a',
    backgroundColor: '#fff',
  },
  charCounter: {
    position: 'absolute',
    right: 10,
    bottom: 8,
    fontSize: 12,
    color: GREY_TEXT,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BUTTON_NAVY,
    borderRadius: 10,
    paddingVertical: 14,
    marginBottom: 18,
  },
  primaryBtnDisabled: {
    opacity: 0.85,
  },
  primaryBtnLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  btnIcon: {
    marginRight: 8,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: GREY_BORDER,
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 12,
    color: GREY_TEXT,
    fontWeight: '500',
  },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: BUTTON_NAVY,
    borderRadius: 10,
    paddingVertical: 13,
    marginBottom: 24,
    backgroundColor: '#fff',
  },
  outlineBtnLabel: {
    color: BUTTON_NAVY,
    fontSize: 16,
    fontWeight: '700',
  },
});
