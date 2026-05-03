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
import { getClassifyImageUrl, getClassifyUrl } from '../config/messageAnalyzerApi';
import { getOrCreateDeviceUserId } from '../lib/deviceUserId';

type Props = NativeStackScreenProps<DetectStackParamList, 'MessageAnalyzer'>;

const PRIMARY_RED = '#E53535';
const BUTTON_NAVY = '#202871';
const GREY_TEXT = '#6B7280';
const GREY_BORDER = '#C8CED6';
const MAX_CHARS = 2000;

async function readClassifyError(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const j = JSON.parse(text) as { detail?: unknown };
    if (typeof j.detail === 'string') {
      return j.detail;
    }
    if (Array.isArray(j.detail) && j.detail.length > 0) {
      const first = j.detail[0] as { msg?: string };
      if (typeof first?.msg === 'string') {
        return first.msg;
      }
    }
  } catch {
    /* fall through */
  }
  if (text.length > 0 && text.length < 400) {
    return text;
  }
  return `Request failed (${response.status})`;
}

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
      const userId = await getOrCreateDeviceUserId();
      const response = await fetch(getClassifyUrl(), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, user_id: userId }),
      });
      if (!response.ok) {
        const errMsg = await readClassifyError(response);
        Alert.alert('Could not analyze', errMsg);
        return;
      }
      const data = (await response.json()) as Record<string, unknown>;
      navigation.navigate('ResultScreen', {
        result: data,
        pastedMessage: text,
      });
    } catch {
      Alert.alert('Connection Error', 'Could not reach server. Check Wi‑Fi and that the API is running.');
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
    const asset = pick.assets[0];
    setLoading(true);
    try {
      const userId = await getOrCreateDeviceUserId();
      const form = new FormData();
      form.append('user_id', userId);
      form.append('file', {
        uri: asset.uri,
        name: asset.fileName ?? 'screenshot.jpg',
        type: asset.mimeType ?? 'image/jpeg',
      } as unknown as Blob);

      const response = await fetch(getClassifyImageUrl(), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
        body: form,
      });
      if (!response.ok) {
        const errMsg = await readClassifyError(response);
        Alert.alert('Could not analyze image', errMsg);
        return;
      }
      const data = (await response.json()) as Record<string, unknown>;
      const extracted =
        typeof data.original_text === 'string'
          ? data.original_text
          : typeof data.extracted_text === 'string'
            ? data.extracted_text
            : '';
      navigation.navigate('ResultScreen', {
        result: data,
        pastedMessage: extracted,
        imageUri: asset.uri,
        isImage: true,
      });
    } catch {
      Alert.alert(
        'Connection Error',
        'Could not reach server. Check Wi‑Fi and that the API is running.'
      );
    } finally {
      setLoading(false);
    }
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
