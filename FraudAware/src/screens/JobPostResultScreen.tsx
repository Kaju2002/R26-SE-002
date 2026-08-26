import React, { useCallback, useState } from 'react';
import {
  Image,
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
import { MaterialIcons } from '@expo/vector-icons';
import type { DetectStackParamList, JobPostHighlight } from '../navigation/detectStackTypes';

type Props = NativeStackScreenProps<DetectStackParamList, 'JobPostResult'>;

const NAVY = '#202871';
const GREY_TEXT = '#6B7280';
const GREY_CARD = '#F3F5F8';
const STORAGE_KEY = 'fraudaware_job_scans';

type Verdict = 'fake' | 'suspicious' | 'legitimate';

function resolveVerdict(prediction: string): Verdict {
  const p = prediction.toLowerCase();
  if (p.includes('fake') || p.includes('fraud')) return 'fake';
  if (p.includes('suspicious')) return 'suspicious';
  return 'legitimate';
}

const COPY: Record<
  Verdict,
  {
    badge: string;
    headline: string;
    body: string;
    accent: string;
    accentBg: string;
    cardBg: string;
    next: string[];
  }
> = {
  fake: {
    badge: 'High risk',
    headline: 'This job post looks fake.',
    body: 'The wording matches patterns we often see in scam listings. Do not apply or send documents until you can verify the employer independently.',
    accent: '#C62828',
    accentBg: '#FDECEA',
    cardBg: '#FFF8F7',
    next: [
      'Do not apply through this listing.',
      'Do not share ID copies, bank details, or pay any fee.',
      'Report the post on the site where you found it.',
    ],
  },
  suspicious: {
    badge: 'Needs review',
    headline: 'This post needs a closer look.',
    body: 'Some details look off, but it is not a clear fake. Check the company through official channels before you apply.',
    accent: '#EF6C00',
    accentBg: '#FFF3E0',
    cardBg: '#FFFBF5',
    next: [
      'Look up the company on a registry or their real website.',
      'Never pay an upfront fee to get the job.',
      'Confirm the recruiter using a published company email, not WhatsApp alone.',
    ],
  },
  legitimate: {
    badge: 'Low risk',
    headline: 'This job post looks legitimate.',
    body: 'We did not find the usual scam signals in this poster. Still confirm the employer before you share personal details.',
    accent: '#1B5E20',
    accentBg: '#E8F5E9',
    cardBg: '#F7FBF8',
    next: [
      'Apply through the company’s official careers page when you can.',
      'Keep communication on the platform or a company email.',
      'Treat any request for payment as a warning sign.',
    ],
  },
};

function ScoreRow({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <View>
      <View style={styles.scoreRowTop}>
        <Text style={styles.scoreLabel}>{label}</Text>
        <Text style={[styles.scoreValue, { color }]}>{pct}%</Text>
      </View>
      <View style={styles.scoreTrack}>
        <View style={[styles.scoreFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function mergeHighlights(lime: JobPostHighlight[], shap: JobPostHighlight[]) {
  const seen = new Set<string>();
  const out: JobPostHighlight[] = [];
  for (const item of [...lime, ...shap]) {
    const key = item.token.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out.slice(0, 16);
}

function WordChips({ items }: { items: JobPostHighlight[] }) {
  if (!items.length) return null;
  return (
    <View style={styles.chipWrap}>
      {items.map((item) => {
        const towardFake = item.toward !== 'legitimate';
        return (
          <View
            key={`${item.token}-${item.weight}`}
            style={[
              styles.chip,
              { backgroundColor: towardFake ? '#FDECEA' : '#E8F5E9' },
            ]}
          >
            <Text
              style={[
                styles.chipText,
                { color: towardFake ? '#C62828' : '#1B5E20' },
              ]}
            >
              {item.token}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export default function JobPostResultScreen({ navigation, route }: Props) {
  const {
    prediction,
    confidence,
    legitimate_probability,
    fake_probability,
    extracted_text,
    message,
    imageUri,
    lime = [],
    shap = [],
  } = route.params;

  const verdict = resolveVerdict(prediction);
  const copy = COPY[verdict];
  const [showFullText, setShowFullText] = useState(false);
  const [saved, setSaved] = useState(false);
  const tabBarHeight = useBottomTabBarHeight();
  const highlightItems = mergeHighlights(lime, shap);
  const previewText =
    extracted_text.length > 220 ? `${extracted_text.slice(0, 220)}…` : extracted_text;

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
      // keep the screen usable if storage fails
    }
  }, [saved, prediction, confidence, message]);

  const onShare = useCallback(async () => {
    await Share.share({
      message: `FraudAware job post scan\n${copy.headline}\n${Math.round(confidence * 100)}% model confidence\n\n${message}`,
    });
  }, [copy.headline, confidence, message]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerSide}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <MaterialIcons name="arrow-back" size={24} color={NAVY} />
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
          <MaterialIcons name="share" size={22} color={NAVY} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: tabBarHeight + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.summaryCard,
            { borderColor: copy.accent, backgroundColor: copy.cardBg },
          ]}
        >
          <View style={[styles.badge, { backgroundColor: copy.accentBg }]}>
            <Text style={[styles.badgeText, { color: copy.accent }]}>{copy.badge}</Text>
          </View>
          <Text style={styles.summaryTitle}>Quick summary</Text>
          <Text style={[styles.headline, { color: copy.accent }]}>{copy.headline}</Text>
          <Text style={styles.body}>{copy.body}</Text>
          <Text style={styles.metaLine}>
            Model confidence{' '}
            <Text style={[styles.metaStrong, { color: copy.accent }]}>
              {Math.round(confidence * 100)}%
            </Text>
          </Text>
        </View>

        {imageUri ? (
          <>
            <Text style={styles.sectionTitle}>Job poster</Text>
            <View style={styles.posterWrap}>
              <Image
                source={{ uri: imageUri }}
                style={styles.poster}
                resizeMode="contain"
              />
            </View>
          </>
        ) : null}

        <Text style={styles.sectionTitle}>How the score was calculated</Text>
        <View style={styles.sectionCard}>
          <ScoreRow label="Legitimate" value={legitimate_probability} color="#1B5E20" />
          <ScoreRow label="Fake" value={fake_probability} color="#C62828" />
        </View>

        {highlightItems.length ? (
          <>
            <Text style={styles.sectionTitle}>Words that stood out</Text>
            <View style={styles.sectionCard}>
              <WordChips items={highlightItems} />
              <Text style={styles.hint}>
                Red words pulled the result toward fake. Green words pulled it toward
                legitimate.
              </Text>
            </View>
          </>
        ) : null}

        {extracted_text ? (
          <>
            <Text style={styles.sectionTitle}>Text we read from the image</Text>
            <View style={styles.textBox}>
              <Text style={styles.analyzedText}>
                {showFullText ? extracted_text : previewText}
              </Text>
              {extracted_text.length > 220 ? (
                <TouchableOpacity
                  onPress={() => setShowFullText((open) => !open)}
                  style={styles.toggleBtn}
                >
                  <Text style={styles.toggleBtnText}>
                    {showFullText ? 'Show less' : 'Show more'}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </>
        ) : null}

        <Text style={styles.sectionTitle}>What to do next</Text>
        <View style={styles.sectionCard}>
          {copy.next.map((step) => (
            <Text key={step} style={styles.nextText}>
              • {step}
            </Text>
          ))}
        </View>

        <Text style={styles.disclaimer}>
          This is a model estimate. Always verify the employer yourself before sharing
          personal or financial details.
        </Text>

        <View style={styles.footerRow}>
          <TouchableOpacity
            style={[styles.btnOutline, saved && styles.btnOutlineSaved]}
            onPress={onSave}
            disabled={saved}
          >
            <Text style={[styles.btnOutlineText, saved && styles.btnOutlineTextSaved]}>
              {saved ? 'Saved' : 'Save'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btnFilled}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.btnFilledText}>Scan another</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#fff',
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
    color: NAVY,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  summaryCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 2,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  posterWrap: {
    height: 144,
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F7F8FE',
    borderWidth: 1,
    borderColor: '#C9D2E0',
    marginBottom: 18,
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  summaryTitle: {
    color: NAVY,
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 6,
  },
  headline: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    color: '#374151',
  },
  metaLine: {
    marginTop: 12,
    fontSize: 13,
    color: GREY_TEXT,
  },
  metaStrong: {
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: NAVY,
    marginBottom: 8,
  },
  sectionCard: {
    backgroundColor: GREY_CARD,
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
    gap: 12,
  },
  scoreRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  scoreLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: NAVY,
  },
  scoreValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  scoreTrack: {
    height: 8,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  scoreFill: {
    height: '100%',
    borderRadius: 6,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  hint: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 17,
    color: GREY_TEXT,
  },
  textBox: {
    backgroundColor: GREY_CARD,
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
  },
  analyzedText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#374151',
  },
  toggleBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  toggleBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: NAVY,
  },
  nextText: {
    fontSize: 14,
    lineHeight: 21,
    color: '#374151',
  },
  disclaimer: {
    fontSize: 12,
    lineHeight: 17,
    color: GREY_TEXT,
    marginBottom: 16,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  btnOutline: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: NAVY,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  btnOutlineSaved: {
    borderColor: '#1B5E20',
  },
  btnOutlineText: {
    color: NAVY,
    fontSize: 15,
    fontWeight: '700',
  },
  btnOutlineTextSaved: {
    color: '#1B5E20',
  },
  btnFilled: {
    flex: 1,
    backgroundColor: NAVY,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  btnFilledText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
