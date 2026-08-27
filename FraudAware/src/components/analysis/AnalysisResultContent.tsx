import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import type { AnalysisPayload } from '../../navigation/detectStackTypes';
import {
  displayConfidencePercent,
  getConfidenceScoreCopy,
  getSignalStrengthHeadline,
} from '../../utils/signalStrengthPresentation';
import HighlightedAnalyzedText, {
  WordImportanceChips,
} from './HighlightedAnalyzedText';

const PRIMARY_RED = '#E53535';
const SUCCESS_GREEN = '#3B6D11';
const AMBER_ALERT = '#C27803';
const GREY_TEXT = '#6B7280';
const GREY_CARD = '#F3F5F8';

export const MODEL_DISCLAIMER =
  'Estimates from a model — always verify the employer yourself before sharing personal or financial details.';

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

function verdictVisuals(payload: AnalysisPayload) {
  const isInconclusive = payload.inconclusive === true;
  const isScam = payload.is_scam && !isInconclusive;
  const accent = isInconclusive ? AMBER_ALERT : isScam ? PRIMARY_RED : SUCCESS_GREEN;
  return { isInconclusive, isScam, accent };
}

type SignalBlockProps = {
  payload: AnalysisPayload;
  accent: string;
  signalHeadline: string;
};

/** Plain-language tier, score, and a short hint (see predictor.combine). */
function SignalStrengthBlock({ payload, accent, signalHeadline }: SignalBlockProps) {
  const isInconclusive = payload.inconclusive === true;
  const isScam = payload.is_scam && !isInconclusive;
  const copy = getConfidenceScoreCopy({ isScam, inconclusive: isInconclusive });
  const pct = displayConfidencePercent(payload.confidence);

  return (
    <>
      <Text style={styles.simpleMutedLabel}>Signal strength</Text>
      <Text style={[styles.simpleTier, { color: accent }]} numberOfLines={2}>
        {signalHeadline}
      </Text>
      <Text style={styles.simpleScoreLine}>
        <Text style={[styles.simpleScorePct, { color: accent }]}>{pct}%</Text>
        <Text style={styles.simpleScoreSep}> — </Text>
        <Text style={styles.simpleScoreMetric}>{copy.metricLabel}</Text>
      </Text>
      <Text style={styles.simpleFootnote}>{copy.footnote}</Text>
    </>
  );
}

type VerdictBannerProps = {
  payload: AnalysisPayload;
  style?: ViewStyle;
};

/** Legitimate / scam / inconclusive hero card — can be pinned above scroll on ResultScreen */
export function AnalysisVerdictBanner({ payload, style }: VerdictBannerProps) {
  const { isInconclusive, isScam, accent } = verdictVisuals(payload);
  return (
    <View style={[styles.banner, { backgroundColor: accent }, style]}>
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
            ? 'This message shows patterns often used in scam outreach'
            : 'We did not flag common manipulation tactics in this text'}
      </Text>
    </View>
  );
}

type Props = {
  payload: AnalysisPayload;
  /** When the analyzer ran on an uploaded screenshot */
  showScreenshotSource?: boolean;
  /** Omit the colored verdict card (e.g. when ResultScreen renders it fixed above scroll) */
  omitVerdictBanner?: boolean;
};

/** Shared verdict/tactics/analyzed-text UI used by ResultScreen and conversation sheet */
export default function AnalysisResultContent({
  payload,
  showScreenshotSource,
  omitVerdictBanner = false,
}: Props) {
  const isInconclusive = payload.inconclusive === true;
  const isScam = payload.is_scam && !isInconclusive;
  const isLegitimate = !isScam && !isInconclusive;
  const tacticCount = payload.tactics.length;
  const accent = isInconclusive ? AMBER_ALERT : isScam ? PRIMARY_RED : SUCCESS_GREEN;
  const signalHeadline = getSignalStrengthHeadline({
    isScam: payload.is_scam,
    inconclusive: isInconclusive,
    confidencePct: payload.confidence,
  });

  const showTacticsCounter = isScam || (isInconclusive && tacticCount > 0);
  const flaggedWords = payload.word_importance ?? [];
  const showWordHighlights = flaggedWords.length > 0;
  const highlightAccent = isScam ? PRIMARY_RED : isInconclusive ? AMBER_ALERT : GREY_TEXT;

  return (
    <>
      {omitVerdictBanner ? null : <AnalysisVerdictBanner payload={payload} />}
      {showScreenshotSource ? (
        <Text
          style={[styles.sourceHint, omitVerdictBanner ? styles.sourceHintBelowFixedBanner : null]}
        >
          Analyzed from uploaded screenshot
        </Text>
      ) : null}

      {showTacticsCounter ? (
        <View style={styles.statsRow}>
          <View style={styles.simpleStatCard}>
            <SignalStrengthBlock
              payload={payload}
              accent={accent}
              signalHeadline={signalHeadline}
            />
          </View>
          <View style={styles.simpleStatCard}>
            <Text style={[styles.simpleTacticNum, { color: accent }]}>{tacticCount}</Text>
            <Text style={styles.simpleMutedLabel}>
              {isScam ? 'Patterns flagged' : 'Possible patterns'}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.simpleStatCardFull}>
          <SignalStrengthBlock
            payload={payload}
            accent={accent}
            signalHeadline={signalHeadline}
          />
          {isLegitimate ? (
            <View style={styles.verdictFootnote}>
              <MaterialCommunityIcons name="shield-check-outline" size={18} color={SUCCESS_GREEN} />
              <Text style={styles.verdictFootnoteText}>No manipulation tactics detected</Text>
            </View>
          ) : (
            <View style={styles.verdictFootnote}>
              <MaterialCommunityIcons name="information-outline" size={18} color={AMBER_ALERT} />
              <Text style={[styles.verdictFootnoteText, styles.verdictFootnoteTextInconclusive]}>
                No specific patterns listed — follow the guidance below
              </Text>
            </View>
          )}
        </View>
      )}
      <Text style={styles.modelDisclaimer}>{MODEL_DISCLAIMER}</Text>

      {isScam ? (
        <>
          <Text style={styles.sectionLabel}>MANIPULATION TACTICS</Text>
          {payload.tactics.map((t, i) => (
            <View key={`${t.name}-${i}`} style={styles.tacticCard}>
              <View style={styles.tacticIconCircle}>
                <MaterialCommunityIcons name={tacticGlyph(t.name)} size={22} color={PRIMARY_RED} />
              </View>
              <View style={styles.tacticCopy}>
                <Text style={styles.tacticTitle}>{t.name}</Text>
                {t.example ? <Text style={styles.tacticExample}>{t.example}</Text> : null}
              </View>
            </View>
          ))}
        </>
      ) : null}

      <Text style={styles.sectionLabel}>
        {isInconclusive ? 'WHAT TO DO' : isScam ? 'STAY SAFE' : 'WHAT THIS MEANS'}
      </Text>
      <View style={styles.greyBorderCard}>
        <Text style={styles.bodyMuted}>
          {isInconclusive ? payload.reassurance : isScam ? payload.warning : payload.reassurance}
        </Text>
      </View>

      <Text style={styles.sectionLabel}>ANALYZED TEXT</Text>
      {showWordHighlights ? (
        <>
          <Text style={styles.sectionLabelSub}>
            {isScam ? 'Key words flagged' : isInconclusive ? 'Notable words' : 'Words checked'}
          </Text>
          <WordImportanceChips words={flaggedWords} accent={highlightAccent} />
        </>
      ) : null}
      <View style={styles.analyzedWrap}>
        <HighlightedAnalyzedText
          text={payload.original_text}
          wordImportance={flaggedWords}
          baseStyle={styles.analyzedText}
          highlightEnabled={showWordHighlights}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
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
  sourceHintBelowFixedBanner: {
    marginTop: 0,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
    alignItems: 'stretch',
  },
  simpleStatCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: GREY_CARD,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  simpleStatCardFull: {
    backgroundColor: GREY_CARD,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 14,
    alignItems: 'center',
    marginBottom: 18,
  },
  simpleMutedLabel: {
    fontSize: 12,
    color: GREY_TEXT,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 6,
  },
  simpleTier: {
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  simpleScoreLine: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  simpleScorePct: {
    fontWeight: '800',
  },
  simpleScoreSep: {
    color: GREY_TEXT,
    fontWeight: '600',
  },
  simpleScoreMetric: {
    color: GREY_TEXT,
    fontWeight: '600',
  },
  simpleFootnote: {
    fontSize: 11,
    lineHeight: 15,
    color: GREY_TEXT,
    textAlign: 'center',
    fontWeight: '500',
    paddingHorizontal: 2,
  },
  simpleTacticNum: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 4,
    textAlign: 'center',
  },
  verdictFootnote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#D8DCE3',
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  verdictFootnoteText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: SUCCESS_GREEN,
    lineHeight: 18,
  },
  verdictFootnoteTextInconclusive: {
    color: GREY_TEXT,
    fontWeight: '600',
  },
  modelDisclaimer: {
    fontSize: 12,
    color: GREY_TEXT,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 0,
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
  sectionLabelSub: {
    fontSize: 11,
    fontWeight: '600',
    color: GREY_TEXT,
    marginBottom: 8,
    marginTop: -4,
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
    color: '#374151',
    fontStyle: 'italic',
    lineHeight: 22,
  },
});
