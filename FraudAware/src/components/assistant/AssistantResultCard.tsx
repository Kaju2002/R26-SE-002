import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import type {
  AssistantCheck,
  AssistantCheckSource,
  AssistantVerdict,
} from '../../api/assistantApi';

const NAVY = '#202871';
const MUTED = '#5B6473';

export const VERDICT_COLOURS: Record<AssistantVerdict['colour'], { main: string; bg: string; border: string }> = {
  red: { main: '#B42318', bg: '#FEF3F2', border: '#FECDCA' },
  orange: { main: '#B54708', bg: '#FFFAEB', border: '#FEDF89' },
  grey: { main: '#344054', bg: '#F2F4F7', border: '#D0D5DD' },
  green: { main: '#067647', bg: '#ECFDF3', border: '#ABEFC6' },
};

export const CHECK_LABELS: Record<AssistantCheckSource, string> = {
  job_post: 'Job post',
  company: 'Company',
  recruiter_chat: 'Recruiter messages',
};

const COLOURS = VERDICT_COLOURS;

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const SOURCE_ICON: Record<AssistantCheckSource, IconName> = {
  job_post: 'briefcase-outline',
  company: 'office-building-outline',
  recruiter_chat: 'message-text-outline',
};

function readableTitle(title: string): string {
  if (title.length > 3 && title === title.toUpperCase()) {
    return title.charAt(0) + title.slice(1).toLowerCase();
  }
  return title;
}

function firstSentence(check: AssistantCheck): string | null {
  const reasons = check.reasons ?? [];
  const watch = reasons.find((reason) => reason.startsWith('Watch-outs:'));
  const found = reasons.find((reason) => reason.startsWith('What we found:'));
  const chosen =
    check.risk === 'high' || check.risk === 'medium' ? watch || found || reasons[0] : found || reasons[0];
  if (!chosen) return null;
  const text = chosen.replace(/^(What we found|Watch-outs|What to do):\s*/, '').split('. ')[0];
  return text.endsWith('.') ? text : `${text}.`;
}

export function describeCheck(check: AssistantCheck): { text: string; icon: IconName; colour: string } {
  if (check.status === 'done') {
    switch (check.risk) {
      case 'high':
        return { text: 'Strong warning signs', icon: 'alert-octagon', colour: COLOURS.red.main };
      case 'medium':
        return { text: 'Some warning signs', icon: 'alert', colour: COLOURS.orange.main };
      case 'low':
        return { text: 'No strong warning signs', icon: 'check-circle', colour: COLOURS.green.main };
      default:
        return { text: 'Could not be confirmed', icon: 'help-circle-outline', colour: MUTED };
    }
  }
  const other: Record<string, string> = {
    skipped: 'Skipped',
    not_applicable: 'Not needed',
    failed: 'Could not be checked',
    running: 'Checking…',
    missing: 'Not checked',
  };
  return { text: other[check.status] ?? 'Not checked', icon: 'minus-circle-outline', colour: MUTED };
}

/** Plain-text summary for the phone's share sheet (WhatsApp, email, ...). */
export function buildShareText(verdict: AssistantVerdict): string {
  const lines = [`FraudAware check: ${verdict.title}`];
  for (const check of verdict.checks) {
    const line = `${CHECK_LABELS[check.source]}: ${describeCheck(check).text}`;
    const reason = check.status === 'done' ? check.reasons[0] : undefined;
    lines.push(reason ? `${line} (${reason})` : line);
  }
  if (verdict.note) lines.push('', verdict.note);
  lines.push('', verdict.disclaimer);
  return lines.join('\n');
}

type Props = {
  verdict: AssistantVerdict;
  onShare: () => void;
  onReport?: () => void;
  reportBusy?: boolean;
};

export default function AssistantResultCard({ verdict, onShare, onReport, reportBusy }: Props) {
  const colour = COLOURS[verdict.colour];

  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>Your check</Text>
      <Text style={[styles.title, { color: colour.main }]}>{readableTitle(verdict.title)}</Text>
      {verdict.note ? <Text style={styles.note}>{verdict.note}</Text> : null}

      <View style={styles.checks}>
        {verdict.checks.map((check) => {
          const d = describeCheck(check);
          const line = firstSentence(check);
          return (
            <View key={check.source} style={styles.checkRow}>
              <View style={styles.sourceIcon}>
                <MaterialCommunityIcons name={SOURCE_ICON[check.source]} size={18} color={NAVY} />
              </View>
              <View style={styles.checkCopy}>
                <View style={styles.checkHead}>
                  <Text style={styles.checkLabel}>{CHECK_LABELS[check.source]}</Text>
                  <Text style={[styles.checkStatus, { color: d.colour }]}>{d.text}</Text>
                </View>
                {line ? <Text style={styles.checkLine}>{line}</Text> : null}
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.tip}>
        <Text style={styles.tipText}>{verdict.disclaimer}</Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={onShare}
          accessibilityRole="button"
          accessibilityLabel="Share result"
          style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.85 }]}
        >
          <MaterialIcons name="share" size={18} color="#FFFFFF" />
          <Text style={styles.shareText}>Share</Text>
        </Pressable>
        {onReport ? (
          <Pressable
            onPress={onReport}
            disabled={reportBusy}
            accessibilityRole="button"
            accessibilityLabel="Download PDF report"
            style={({ pressed }) => [styles.pdfBtn, (pressed || reportBusy) && { opacity: 0.7 }]}
          >
            {reportBusy ? (
              <ActivityIndicator size="small" color={NAVY} />
            ) : (
              <MaterialCommunityIcons name="file-pdf-box" size={20} color={NAVY} />
            )}
            <Text style={styles.pdfText}>Save PDF</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3E8F3',
    borderRadius: 20,
    padding: 16,
    marginTop: 4,
  },
  kicker: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: MUTED,
    marginBottom: 2,
  },
  title: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 20,
    marginBottom: 8,
  },
  note: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    lineHeight: 19,
    color: MUTED,
    marginBottom: 8,
  },
  checks: {
    gap: 8,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#F7F8FC',
    borderRadius: 14,
    padding: 12,
  },
  sourceIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCopy: {
    flex: 1,
  },
  checkHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  checkLabel: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: NAVY,
  },
  checkStatus: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'right',
    flexShrink: 1,
  },
  checkLine: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    lineHeight: 18,
    color: '#3D4A6B',
    marginTop: 4,
  },
  tip: {
    marginTop: 12,
    backgroundColor: '#E8EEFF',
    borderRadius: 14,
    padding: 12,
  },
  tipText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    lineHeight: 18,
    color: '#3D4A6B',
  },
  actions: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 10,
  },
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 12,
    backgroundColor: NAVY,
  },
  shareText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  pdfBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 12,
    backgroundColor: '#EEF1F8',
  },
  pdfText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: NAVY,
  },
});
