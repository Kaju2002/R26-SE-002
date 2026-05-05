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
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import type { DetectStackParamList } from '../navigation/detectStackTypes';
import { getClassifyImageUrl, getClassifyUrl, getOcrOnlyUrl } from '../config/messageAnalyzerApi';
import { getOrCreateDeviceUserId } from '../lib/deviceUserId';
import {
  clearAllHistory,
  deleteHistoryScan,
  fetchHealth,
  fetchHistory,
} from '../api/fraudawareApi';
import RecentScansList from '../components/RecentScansList';
import type { RecentScanItem } from '../components/ui_component/recentScanTypes';
import { historyScanToRecentItem } from '../utils/mapHistoryScan';

type Props = NativeStackScreenProps<DetectStackParamList, 'MessageAnalyzer'>;

const PRIMARY_RED = '#E53535';
const BUTTON_NAVY = '#202871';
const GREY_TEXT = '#6B7280';
const GREY_BORDER = '#C8CED6';
const MAX_CHARS = 2000;
/** Min non-whitespace chars to count multi-screenshot OCR as successful (avoids blurry noise). */
const OCR_MIN_MEANINGFUL_CHARS = 20;

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
  const [loadingText, setLoadingText] = useState('');
  const [recentScans, setRecentScans] = useState<RecentScanItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  /** When true, classify/image routes should not run (health or model). */
  const [analysisBlocked, setAnalysisBlocked] = useState(false);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const userId = await getOrCreateDeviceUserId();
      const data = await fetchHistory(userId);
      setRecentScans(data.scans.map(historyScanToRecentItem));
    } catch {
      setRecentScans([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const refreshHealthOnly = useCallback(async () => {
    const h = await fetchHealth();
    if (!h.ok) {
      setAnalysisBlocked(true);
      return;
    }
    setAnalysisBlocked(!h.modelLoaded);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        await refreshHealthOnly();
        if (!cancelled) {
          await loadHistory();
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [loadHistory, refreshHealthOnly])
  );

  const ensureServerReadyForAnalysis = useCallback(async (): Promise<boolean> => {
    const h = await fetchHealth();
    if (!h.ok) {
      Alert.alert(
        'Server unavailable',
        'Could not reach the analysis server. Check your network and that the API is running.'
      );
      setAnalysisBlocked(true);
      return false;
    }
    if (!h.modelLoaded) {
      Alert.alert(
        'Server unavailable',
        'The detection model is not loaded on the server yet. Try again in a moment.'
      );
      setAnalysisBlocked(true);
      return false;
    }
    setAnalysisBlocked(false);
    return true;
  }, []);

  const confirmDeleteScan = useCallback(
    (scanId: string) => {
      Alert.alert(
        'Delete this scan?',
        'It will be removed from your saved history on the server.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteHistoryScan(scanId);
                await loadHistory();
              } catch (e) {
                Alert.alert('Could not delete', e instanceof Error ? e.message : 'Unknown error');
              }
            },
          },
        ]
      );
    },
    [loadHistory]
  );

  const confirmClearAll = useCallback(() => {
    Alert.alert(
      'Clear all history?',
      "This can't be undone. All scans for this device will be removed from the server.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear all',
          style: 'destructive',
          onPress: async () => {
            try {
              const userId = await getOrCreateDeviceUserId();
              await clearAllHistory(userId);
              await loadHistory();
            } catch (e) {
              Alert.alert('Could not clear history', e instanceof Error ? e.message : 'Unknown error');
            }
          },
        },
      ]
    );
  }, [loadHistory]);

  const onAnalyze = useCallback(async () => {
    const text = messageText.trim();
    if (!text.length) {
      Alert.alert('Missing message', 'Please paste a message to analyze.');
      return;
    }
    setLoading(true);
    setLoadingText('Analyzing message...');
    try {
      if (!(await ensureServerReadyForAnalysis())) {
        return;
      }
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
      await loadHistory();
      navigation.navigate('ResultScreen', {
        result: data,
        pastedMessage: text,
      });
    } catch {
      Alert.alert('Connection Error', 'Could not reach server. Check Wi‑Fi and that the API is running.');
    } finally {
      setLoading(false);
      setLoadingText('');
    }
  }, [ensureServerReadyForAnalysis, loadHistory, messageText, navigation]);

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
    setLoadingText('Reading screenshot...');
    try {
      if (!(await ensureServerReadyForAnalysis())) {
        return;
      }
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
      await loadHistory();
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
      setLoadingText('');
    }
  }, [ensureServerReadyForAnalysis, loadHistory, navigation]);

  const onAnalyzeConversationScreenshots = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to upload screenshots.');
      return;
    }

    const pick = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      allowsEditing: false,
      allowsMultipleSelection: true,
      selectionLimit: 5,
    });

    if (pick.canceled || !pick.assets?.length) {
      return;
    }

    const assets = pick.assets.slice(0, 5);
    setLoading(true);
    try {
      if (!(await ensureServerReadyForAnalysis())) {
        return;
      }

      const userId = await getOrCreateDeviceUserId();
      const extractedTexts: string[] = [];
      const failedIndexes: number[] = [];

      for (let i = 0; i < assets.length; i += 1) {
        const asset = assets[i];
        setLoadingText(`Reading screenshot ${i + 1} of ${assets.length}...`);
        try {
          const form = new FormData();
          form.append('user_id', userId);
          form.append('file', {
            uri: asset.uri,
            name: asset.fileName ?? `screenshot-${i + 1}.jpg`,
            type: asset.mimeType ?? 'image/jpeg',
          } as unknown as Blob);

          const ocrResponse = await fetch(getOcrOnlyUrl(), {
            method: 'POST',
            headers: {
              Accept: 'application/json',
            },
            body: form,
          });

          if (!ocrResponse.ok) {
            failedIndexes.push(i + 1);
            continue;
          }

          const ocrData = (await ocrResponse.json()) as Record<string, unknown>;
          const ocrSuccess = ocrData.success === true;
          const extractedText =
            typeof ocrData.extracted_text === 'string' ? ocrData.extracted_text.trim() : '';
          const normalizedLength = extractedText.replace(/\s+/g, ' ').trim().length;
          if (ocrSuccess && normalizedLength >= OCR_MIN_MEANINGFUL_CHARS) {
            extractedTexts.push(extractedText);
          } else {
            failedIndexes.push(i + 1);
          }
        } catch {
          failedIndexes.push(i + 1);
        }
      }

      const combinedText = extractedTexts.join(' ').trim();
      if (!combinedText.length) {
        Alert.alert(
          'Could not read screenshots.',
          'Could not read text from any screenshot. Please try clearer images.'
        );
        return;
      }

      setLoadingText('Analyzing conversation...');
      const classifyResponse = await fetch(getClassifyUrl(), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: combinedText,
          user_id: userId,
        }),
      });

      if (!classifyResponse.ok) {
        Alert.alert('Analysis failed. Please try again.');
        return;
      }

      const data = (await classifyResponse.json()) as Record<string, unknown>;
      await loadHistory();
      if (failedIndexes.length > 0) {
        Alert.alert(
          'Partial OCR completed',
          `Could not read screenshot(s): ${failedIndexes.join(', ')}. Analysis based on remaining screenshots.`
        );
      }

      navigation.navigate('ResultScreen', {
        result: data,
        pastedMessage: combinedText,
        screenshotCount: extractedTexts.length,
        screenshotTotal: assets.length,
      });
    } catch {
      Alert.alert('Connection failed. Check your connection.');
    } finally {
      setLoading(false);
      setLoadingText('');
    }
  }, [ensureServerReadyForAnalysis, loadHistory, navigation]);

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

        <View style={styles.screenBody}>
          <View style={styles.fixedTopSection}>
          <View style={styles.infoBanner}>
            <Text style={styles.bannerText}>
              We scan recruiter messages for common scam signals.
            </Text>
          </View>

          {analysisBlocked ? (
            <View style={styles.serverBanner}>
              <MaterialCommunityIcons name="cloud-off-outline" size={22} color="#B71C1C" />
              <Text style={styles.serverBannerText}>
                Server unavailable — analysis is disabled until the API is reachable and the model is loaded.
              </Text>
            </View>
          ) : null}

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
            style={[styles.primaryBtn, (loading || analysisBlocked) && styles.primaryBtnDisabled]}
            onPress={onAnalyze}
            disabled={loading || analysisBlocked}
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
            style={[styles.outlineBtn, (loading || analysisBlocked) && styles.outlineBtnDisabled]}
            onPress={onUploadScreenshot}
            activeOpacity={0.85}
            disabled={loading || analysisBlocked}
          >
            <MaterialCommunityIcons name="image-outline" size={22} color={BUTTON_NAVY} style={styles.btnIcon} />
            <Text style={styles.outlineBtnLabel}>Upload Chat Screenshot</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryOutlineBtn, (loading || analysisBlocked) && styles.outlineBtnDisabled]}
            onPress={onAnalyzeConversationScreenshots}
            activeOpacity={0.85}
            disabled={loading || analysisBlocked}
          >
            <MaterialCommunityIcons
              name="image-multiple-outline"
              size={22}
              color={BUTTON_NAVY}
              style={styles.btnIcon}
            />
            <Text style={styles.secondaryOutlineBtnLabel}>
              Analyze Conversation (Multiple Screenshots)
            </Text>
          </TouchableOpacity>

          {loading && loadingText.length > 0 ? (
            <View style={styles.progressWrap}>
              <ActivityIndicator color={BUTTON_NAVY} />
              <Text style={styles.progressText}>{loadingText}</Text>
            </View>
          ) : null}

          </View>

          <ScrollView
            style={styles.recentListScroll}
            contentContainerStyle={styles.recentListContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
          <View style={styles.recentSectionHeader}>
            <Text style={styles.sectionLabel}>RECENT SCANS</Text>
            {recentScans.length > 0 ? (
              <TouchableOpacity onPress={confirmClearAll} hitSlop={8}>
                <Text style={styles.clearAllText}>Clear all</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {historyLoading ? (
            <View style={styles.historyLoading}>
              <ActivityIndicator color={BUTTON_NAVY} />
            </View>
          ) : (
            <RecentScansList scans={recentScans} onDeleteItem={confirmDeleteScan} />
          )}
          </ScrollView>
        </View>
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
  screenBody: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  fixedTopSection: {
    flexShrink: 0,
  },
  recentListScroll: {
    flex: 1,
  },
  recentListContent: {
    paddingBottom: 28,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
  },
  infoBanner: {
    backgroundColor: '#F5F7FB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E1E6F0',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  bannerText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#4B5563',
    fontWeight: '500',
  },
  serverBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FFF8F8',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(183, 28, 28, 0.35)',
    padding: 12,
    marginBottom: 18,
  },
  serverBannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: '#5C2A2A',
    fontWeight: '600',
  },
  recentSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 8,
  },
  clearAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B71C1C',
  },
  historyLoading: {
    paddingVertical: 24,
    alignItems: 'center',
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
    marginBottom: 20,
    backgroundColor: '#fff',
  },
  outlineBtnDisabled: {
    opacity: 0.45,
  },
  outlineBtnLabel: {
    color: BUTTON_NAVY,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryOutlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#6170B5',
    borderRadius: 10,
    paddingVertical: 13,
    marginBottom: 20,
    backgroundColor: '#F7F9FF',
  },
  secondaryOutlineBtnLabel: {
    color: '#2D3A85',
    fontSize: 15,
    fontWeight: '700',
  },
  progressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -2,
    marginBottom: 14,
  },
  progressText: {
    marginLeft: 10,
    fontSize: 13,
    color: GREY_TEXT,
    fontWeight: '600',
  },
});
