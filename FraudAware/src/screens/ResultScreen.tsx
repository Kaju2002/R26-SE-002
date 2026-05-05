import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import type { DetectStackParamList } from '../navigation/detectStackTypes';
import type { AnalysisPayload } from '../navigation/detectStackTypes';
import { analysisPayloadFromApi } from '../utils/mergeAnalysisResult';
import { getSignalStrengthHeadline } from '../utils/signalStrengthPresentation';

type Props = NativeStackScreenProps<DetectStackParamList, 'ResultScreen'>;

const PRIMARY_RED = '#E53535';
const SUCCESS_GREEN = '#3B6D11';
const AMBER_ALERT = '#C27803';
const BUTTON_NAVY = '#202871';

const MODEL_DISCLAIMER =
  'Estimates from a model — always verify the employer yourself before sharing personal or financial details.';
const GREY_TEXT = '#6B7280';
const GREY_CARD = '#F3F5F8';
const STORAGE_KEY = '@fraudaware:message_analysis_snapshots';
/** Base padding below scroll body; tab bar floats with `position: 'absolute'` in BottomTabNavigator. */
const SCROLL_PADDING_BOTTOM_BASE = 32;
const TAB_BAR_FALLBACK_HEIGHT = 68;
const TAB_BAR_GAP = 14;

function tacticGlyph(
  name: string
): React.ComponentProps<typeof MaterialCommunityIcons>['name'] {
  const n = name.toLowerCase();
  if (n.includes('urgency') || n.includes('deadline')) {
    return 'clock-outline';
  }
  if (n.includes('fomo') || n.includes('scarcity') || n.includes('waiting')) {
    return 'account-group-outline';
  }
  if (n.includes('fee') || n.includes('payment') || n.includes('money') || n.includes('wire')) {
    return 'cash-remove';
  }
  if (n.includes('secret') || n.includes('private') || n.includes('off-platform')) {
    return 'eye-off-outline';
  }
  return 'alert-circle-outline';
}

function toNonNegativeInt(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  if (typeof value === 'string') {
    const t = value.trim();
    if (t === '') {
      return undefined;
    }
    const n = Number.parseInt(t, 10);
    if (!Number.isNaN(n)) {
      return Math.max(0, n);
    }
  }
  return undefined;
}

export default function ResultScreen({ navigation, route }: Props) {
  const {
    analysis,
    result,
    pastedMessage = '',
    imageUri,
    isImage,
    screenshotCount,
    screenshotTotal,
  } = route.params;
  const [saving, setSaving] = useState(false);
  const tabBarHeight = useBottomTabBarHeight();
  const overlayTabHeight = tabBarHeight > 0 ? tabBarHeight : TAB_BAR_FALLBACK_HEIGHT;
  const scrollPaddingBottom =
    SCROLL_PADDING_BOTTOM_BASE + overlayTabHeight + TAB_BAR_GAP;

  const payload = useMemo((): AnalysisPayload | null => {
    if (analysis) {
      return analysis;
    }
    if (result == null || Object.keys(result).length === 0) {
      return null;
    }
    return analysisPayloadFromApi(result, pastedMessage || '');
  }, [analysis, result, pastedMessage]);

  if (payload == null) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>No analysis</Text>
          <Text style={styles.emptySub}>
            Run an analysis from the Message Analyzer to see results here.
          </Text>
          <TouchableOpacity
            style={styles.emptyPrimaryBtn}
            onPress={() => navigation.navigate('MessageAnalyzer')}
          >
            <Text style={styles.btnFilledText}>Go to Message Analyzer</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isInconclusive = payload.inconclusive === true;
  const isScam = payload.is_scam && !isInconclusive;
  const accent = isInconclusive ? AMBER_ALERT : isScam ? PRIMARY_RED : SUCCESS_GREEN;
  const signalHeadline = getSignalStrengthHeadline({
    isScam: payload.is_scam,
    inconclusive: isInconclusive,
    confidencePct: payload.confidence,
  });

  const screenshotTotalInt = toNonNegativeInt(screenshotTotal);
  const screenshotReadInt = toNonNegativeInt(screenshotCount) ?? 0;
  const showMultiScreenshotSummary =
    screenshotTotalInt !== undefined && screenshotTotalInt > 0;
  const screenshotWord = screenshotTotalInt === 1 ? 'screenshot' : 'screenshots';
  const screenshotSummaryLine = showMultiScreenshotSummary
    ? `${screenshotReadInt} of ${screenshotTotalInt} ${screenshotWord} read successfully`
    : '';

  const onSave = useCallback(async () => {
    try {
      setSaving(true);
      const entry = {
        savedAt: new Date().toISOString(),
        ...payload,
      };
      const existing = await AsyncStorage.getItem(STORAGE_KEY);
      const list: typeof entry[] = existing ? JSON.parse(existing) : [];
      list.unshift(entry);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 50)));
      Alert.alert('Saved', 'Analysis saved on this device.');
    } catch {
      Alert.alert('Save failed', 'Could not write to storage.');
    } finally {
      setSaving(false);
    }
  }, [payload]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {showMultiScreenshotSummary ? (
        <View style={styles.screenshotSummaryStrip} accessibilityLabel={screenshotSummaryLine}>
          <View style={styles.conversationBadge}>
            <MaterialCommunityIcons
              name="image-multiple-outline"
              size={18}
              color="#2D3A85"
            />
            <Text style={styles.conversationBadgeText}>{screenshotSummaryLine}</Text>
          </View>
        </View>
      ) : null}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scroll, { paddingBottom: scrollPaddingBottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Banner */}
        <View style={[styles.banner, { backgroundColor: accent }]}>
          <View style={styles.bannerIconOuter}>
            <MaterialIcons
              name={isInconclusive ? 'help-outline' : isScam ? 'warning' : 'verified'}
              size={40}
              color="#fff"
            />
          </View>
          <Text style={styles.bannerTitle}>
            {isInconclusive ? 'INCONCLUSIVE' : isScam ? 'SCAM DETECTED' : 'LEGITIMATE MESSAGE'}
          </Text>
          <Text style={styles.bannerSubtitle}>
            {isInconclusive
              ? 'Not enough reliable signal for a definitive safe vs. scam verdict'
              : isScam
                ? 'This message contains manipulation tactics'
                : 'Looks consistent with legitimate recruiter outreach'}
          </Text>
        </View>
        {isImage && imageUri ? (
          <Text style={styles.sourceHint}>Analyzed from uploaded screenshot</Text>
        ) : null}

        {/* Stats — categorical signal strength instead of implying precise calibration */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={[styles.statStrengthHeadline, { color: accent }]} numberOfLines={2}>
              {signalHeadline}
            </Text>
            <Text style={styles.statLabel}>Signal strength</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValueNumeric, { color: accent }]}>{payload.tactics.length}</Text>
            <Text style={styles.statLabel}>Tactics found</Text>
          </View>
        </View>
        <Text style={styles.modelDisclaimer}>{MODEL_DISCLAIMER}</Text>

        {/* Tactics */}
        {isScam ? (
          <>
            <Text style={styles.sectionLabel}>MANIPULATION TACTICS</Text>
            {payload.tactics.map((t, i) => (
              <View key={`${t.name}-${i}`} style={styles.tacticCard}>
                <View style={styles.tacticIconCircle}>
                  <MaterialCommunityIcons
                    name={tacticGlyph(t.name)}
                    size={22}
                    color={PRIMARY_RED}
                  />
                </View>
                <View style={styles.tacticCopy}>
                  <Text style={styles.tacticTitle}>{t.name}</Text>
                  {t.example ? (
                    <Text style={styles.tacticExample}>{t.example}</Text>
                  ) : null}
                </View>
              </View>
            ))}
          </>
        ) : null}

        {/* Warning / reassurance */}
        <Text style={styles.sectionLabel}>
          {isInconclusive ? 'WHAT TO DO' : isScam ? 'WARNING' : 'WHAT THIS MEANS'}
        </Text>
        <View style={styles.greyBorderCard}>
          <Text style={styles.bodyMuted}>
            {isInconclusive ? payload.reassurance : isScam ? payload.warning : payload.reassurance}
          </Text>
        </View>

        {/* Original */}
        <Text style={styles.sectionLabel}>ANALYZED TEXT</Text>
        <View style={styles.analyzedWrap}>
          <Text style={styles.analyzedText}>{payload.original_text}</Text>
        </View>

        <View style={styles.footerSpacer} />

        <View style={styles.footerRow}>
          <TouchableOpacity
            style={[styles.btnOutline, { borderColor: BUTTON_NAVY }]}
            onPress={onSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={BUTTON_NAVY} />
            ) : (
              <Text style={[styles.btnOutlineText, { color: BUTTON_NAVY }]}>Save</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btnFilled, { backgroundColor: BUTTON_NAVY }]}
            onPress={() => navigation.navigate('MessageAnalyzer')}
          >
            <Text style={styles.btnFilledText}>Analyze Another</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FAFAFB',
  },
  screenshotSummaryStrip: {
    flexShrink: 0,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8EDF5',
    backgroundColor: '#FAFAFB',
  },
  scrollView: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  conversationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F4FF',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
    flexShrink: 0,
  },
  conversationBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2D3A85',
  },
  banner: {
    borderRadius: 14,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 14,
  },
  bannerIconOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  bannerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  bannerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.95)',
    textAlign: 'center',
    lineHeight: 20,
  },
  sourceHint: {
    marginTop: -4,
    marginBottom: 14,
    textAlign: 'center',
    fontSize: 12,
    color: GREY_TEXT,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: GREY_CARD,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 96,
  },
  statStrengthHeadline: {
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 6,
  },
  statValueNumeric: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: GREY_TEXT,
    fontWeight: '600',
    textAlign: 'center',
  },
  modelDisclaimer: {
    fontSize: 12,
    color: GREY_TEXT,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: -8,
    marginBottom: 18,
    paddingHorizontal: 4,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    color: GREY_TEXT,
    marginBottom: 10,
    marginTop: 4,
  },
  tacticCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(229, 53, 53, 0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(229, 53, 53, 0.35)',
    marginBottom: 10,
    gap: 12,
  },
  tacticIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tacticCopy: {
    flex: 1,
    minWidth: 0,
  },
  tacticTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: PRIMARY_RED,
    marginBottom: 6,
  },
  tacticExample: {
    fontSize: 13,
    color: PRIMARY_RED,
    fontStyle: 'italic',
    lineHeight: 18,
    opacity: 0.92,
  },
  greyBorderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D8DCE3',
    padding: 14,
    marginBottom: 18,
  },
  bodyMuted: {
    fontSize: 14,
    color: GREY_TEXT,
    lineHeight: 20,
  },
  analyzedWrap: {
    backgroundColor: GREY_CARD,
    borderRadius: 12,
    padding: 14,
    marginBottom: 22,
  },
  analyzedText: {
    fontSize: 14,
    color: GREY_TEXT,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  emptyWrap: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: BUTTON_NAVY,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    color: GREY_TEXT,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyPrimaryBtn: {
    marginTop: 20,
    alignSelf: 'stretch',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BUTTON_NAVY,
  },
  footerSpacer: {
    flexGrow: 1,
    minHeight: 24,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  btnOutline: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  btnOutlineText: {
    fontSize: 15,
    fontWeight: '800',
  },
  btnFilled: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnFilledText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
});
