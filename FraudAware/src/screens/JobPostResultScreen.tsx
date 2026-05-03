import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Platform,
  ScrollView,
  Share,
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

type Props = NativeStackScreenProps<DetectStackParamList, 'JobPostResult'>;

const BUTTON_NAVY = '#202871';
const GREY_TEXT = '#6B7280';
const STORAGE_KEY = 'fraudaware_job_scans';

type Verdict = 'fake' | 'suspicious' | 'legitimate';

function resolveVerdict(prediction: string): Verdict {
  const p = prediction.toLowerCase();
  if (p.includes('fake') || p.includes('fraud')) return 'fake';
  if (p.includes('suspicious')) return 'suspicious';
  return 'legitimate';
}

const VERDICT_CONFIG = {
  fake: {
    color: '#DC2626',
    bgColor: '#FEF2F2',
    emoji: '⚠️',
    title: 'FAKE JOB POST DETECTED',
    icon: 'shield-alert' as const,
    advice: [
      { icon: '🚫', text: 'Do not apply for this job' },
      { icon: '🚫', text: 'Do not share personal documents' },
      { icon: '✅', text: 'Report this post to the platform' },
    ],
  },
  suspicious: {
    color: '#D97706',
    bgColor: '#FFFBEB',
    emoji: '⚠️',
    title: 'SUSPICIOUS POST',
    icon: 'shield-half-full' as const,
    advice: [
      { icon: '⚠️', text: 'Research the company independently' },
      { icon: '⚠️', text: 'Never pay upfront fees' },
      { icon: '✅', text: 'Check company registration' },
      { icon: '✅', text: 'Verify contact details' },
    ],
  },
  legitimate: {
    color: '#16A34A',
    bgColor: '#F0FDF4',
    emoji: '✅',
    title: 'LEGITIMATE JOB POST',
    icon: 'shield-check' as const,
    advice: [
      { icon: '✅', text: 'This post appears genuine' },
      { icon: '✅', text: 'Always research the company' },
      { icon: '✅', text: 'Apply through official channels' },
    ],
  },
};

function ProbabilityBar({
  label,
  value,
  color,
  delay,
}: {
  label: string;
  value: number;
  color: string;
  delay: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value,
      duration: 800,
      delay,
      useNativeDriver: false,
    }).start();
  }, [anim, value, delay]);

  const pct = Math.round(value * 100);
  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={barStyles.row}>
      <Text style={barStyles.label}>{label}</Text>
      <View style={barStyles.track}>
        <Animated.View style={[barStyles.fill, { width, backgroundColor: color }]} />
      </View>
      <Text style={[barStyles.pct, { color }]}>{pct}%</Text>
    </View>
  );
}

const barStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  label: {
    width: 80,
    fontSize: 13,
    fontWeight: '600',
    color: GREY_TEXT,
  },
  track: {
    flex: 1,
    height: 10,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 6,
  },
  pct: {
    width: 36,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
});

export default function JobPostResultScreen({ navigation, route }: Props) {
  const {
    prediction,
    confidence,
    legitimate_probability,
    fake_probability,
    extracted_text,
    message,
    imageUri,
  } = route.params;

  const verdict = resolveVerdict(prediction);
  const config = VERDICT_CONFIG[verdict];

  const [showFullText, setShowFullText] = useState(false);
  const [saved, setSaved] = useState(false);
  const tabBarHeight = useBottomTabBarHeight();

  // Slide-up banner animation
  const slideAnim = useRef(new Animated.Value(40)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 420,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }),
    ]).start();
  }, [slideAnim, fadeAnim]);

  const onSave = useCallback(async () => {
    if (saved) return;
    try {
      const entry = {
        id: Date.now().toString(),
        type: 'job_post',
        prediction,
        confidence,
        message,
        scannedAt: new Date().toISOString(),
      };
      const existing = await AsyncStorage.getItem(STORAGE_KEY);
      const list = existing ? JSON.parse(existing) : [];
      list.unshift(entry);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 50)));
      setSaved(true);
    } catch {
      // silently fail — user can retry
    }
  }, [saved, prediction, confidence, message]);

  const onShare = useCallback(async () => {
    const pct = Math.round(confidence * 100);
    await Share.share({
      message: `FraudAware Job Post Scan\n\nVerdict: ${config.title}\nConfidence: ${pct}%\n\n${message}`,
    });
  }, [config.title, confidence, message]);

  const confPct = Math.round(confidence * 100);
  const previewText =
    extracted_text.length > 200 ? extracted_text.slice(0, 200) + '…' : extracted_text;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* Header */}
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
          <Text style={styles.headerTitle}>Scan Result</Text>
        </View>
        <TouchableOpacity
          style={[styles.headerSide, styles.headerSideRight]}
          onPress={onShare}
          accessibilityRole="button"
          accessibilityLabel="Share result"
        >
          <MaterialIcons
            name={Platform.OS === 'ios' ? 'ios-share' : 'share'}
            size={22}
            color={BUTTON_NAVY}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: tabBarHeight + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Result banner with slide-up animation */}
        <Animated.View
          style={[
            styles.banner,
            { backgroundColor: config.color },
            { transform: [{ translateY: slideAnim }], opacity: fadeAnim },
          ]}
        >
          <View style={styles.bannerIconOuter}>
            <MaterialCommunityIcons name={config.icon} size={40} color="#fff" />
          </View>
          <Text style={styles.bannerTitle}>{config.title}</Text>
          <Text style={styles.bannerConfidence}>{confPct}% Confidence</Text>
          {message ? <Text style={styles.bannerMessage}>{message}</Text> : null}
        </Animated.View>

        {/* Scanned image */}
        <Text style={styles.sectionLabel}>SCANNED IMAGE</Text>
        <View style={styles.card}>
          <Image source={{ uri: imageUri }} style={styles.scannedImage} resizeMode="cover" />
        </View>

        {/* Probability analysis */}
        <Text style={styles.sectionLabel}>DETECTION ANALYSIS</Text>
        <View style={styles.card}>
          <ProbabilityBar
            label="Legitimate"
            value={legitimate_probability}
            color="#16A34A"
            delay={100}
          />
          <ProbabilityBar
            label="Fake"
            value={fake_probability}
            color="#DC2626"
            delay={250}
          />
        </View>

        {/* Extracted text */}
        {extracted_text ? (
          <>
            <Text style={styles.sectionLabel}>EXTRACTED TEXT</Text>
            <View style={[styles.card, styles.textCard]}>
              <Text style={styles.extractedText}>
                {showFullText ? extracted_text : previewText}
              </Text>
              {extracted_text.length > 200 ? (
                <TouchableOpacity
                  onPress={() => setShowFullText((v) => !v)}
                  style={styles.toggleBtn}
                >
                  <Text style={styles.toggleBtnText}>
                    {showFullText ? 'Show Less' : 'Show More'}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </>
        ) : null}

        {/* Advice */}
        <Text style={styles.sectionLabel}>WHAT THIS MEANS</Text>
        <View style={styles.card}>
          {config.advice.map((item, i) => (
            <View key={i} style={styles.adviceRow}>
              <Text style={styles.adviceEmoji}>{item.icon}</Text>
              <Text style={styles.adviceText}>{item.text}</Text>
            </View>
          ))}
        </View>

        {/* Action buttons */}
        <TouchableOpacity
          style={[styles.saveBtn, saved && styles.saveBtnDone]}
          onPress={onSave}
          disabled={saved}
          activeOpacity={0.85}
        >
          <MaterialIcons
            name={saved ? 'check-circle' : 'save'}
            size={18}
            color="#fff"
            style={styles.btnIcon}
          />
          <Text style={styles.saveBtnText}>{saved ? 'Result Saved' : 'Save Result'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.scanAnotherBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons
            name="magnify"
            size={18}
            color={BUTTON_NAVY}
            style={styles.btnIcon}
          />
          <Text style={styles.scanAnotherText}>Scan Another</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FAFAFB',
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
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: BUTTON_NAVY,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  banner: {
    borderRadius: 16,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 22,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
      },
      android: { elevation: 6 },
    }),
  },
  bannerIconOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.22)',
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
    letterSpacing: 0.6,
    marginBottom: 8,
    textAlign: 'center',
  },
  bannerConfidence: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
  },
  bannerMessage: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.92)',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: GREY_TEXT,
    marginBottom: 10,
    marginTop: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E8EDF3',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
    }),
  },
  scannedImage: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    backgroundColor: '#F0F0F0',
  },
  textCard: {
    backgroundColor: '#F9FAFB',
  },
  extractedText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  toggleBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  toggleBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: BUTTON_NAVY,
    textDecorationLine: 'underline',
  },
  adviceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 10,
  },
  adviceEmoji: {
    fontSize: 16,
    lineHeight: 22,
  },
  adviceText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
    fontWeight: '500',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BUTTON_NAVY,
    borderRadius: 12,
    paddingVertical: 15,
    marginBottom: 12,
  },
  saveBtnDone: {
    backgroundColor: '#16A34A',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  btnIcon: {
    marginRight: 8,
  },
  scanAnotherBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: BUTTON_NAVY,
    borderRadius: 12,
    paddingVertical: 14,
    backgroundColor: '#fff',
  },
  scanAnotherText: {
    color: BUTTON_NAVY,
    fontSize: 16,
    fontWeight: '700',
  },
});
