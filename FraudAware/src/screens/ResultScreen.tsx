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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { DetectStackParamList } from '../navigation/detectStackTypes';
import type { AnalysisPayload } from '../navigation/detectStackTypes';
import { analysisPayloadFromApi } from '../utils/mergeAnalysisResult';
import { saveAnalysisSnapshot } from '../utils/saveAnalysisSnapshot';
import AnalysisResultContent from '../components/analysis/AnalysisResultContent';

type Props = NativeStackScreenProps<DetectStackParamList, 'ResultScreen'>;

const BUTTON_NAVY = '#202871';
const GREY_TEXT = '#6B7280';
/** Base padding below scroll body; tab bar floats with `position: 'absolute'` in BottomTabNavigator. */
const SCROLL_PADDING_BOTTOM_BASE = 32;
const TAB_BAR_FALLBACK_HEIGHT = 68;
const TAB_BAR_GAP = 14;

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

  const onSave = useCallback(async () => {
    if (!payload) return;
    try {
      setSaving(true);
      await saveAnalysisSnapshot(payload);
      Alert.alert('Saved', 'Analysis saved on this device.');
    } catch {
      Alert.alert('Save failed', 'Could not write to storage.');
    } finally {
      setSaving(false);
    }
  }, [payload]);

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

  const screenshotTotalInt = toNonNegativeInt(screenshotTotal);
  const screenshotReadInt = toNonNegativeInt(screenshotCount) ?? 0;
  const showMultiScreenshotSummary =
    screenshotTotalInt !== undefined && screenshotTotalInt > 0;
  const screenshotWord = screenshotTotalInt === 1 ? 'screenshot' : 'screenshots';
  const screenshotSummaryLine = showMultiScreenshotSummary
    ? `${screenshotReadInt} of ${screenshotTotalInt} ${screenshotWord} read successfully`
    : '';

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
        <AnalysisResultContent
          payload={payload}
          showScreenshotSource={Boolean(isImage && imageUri)}
        />

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
