import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import type {
  AssistantCheck,
  AssistantCheckSource,
  AssistantVerdict,
} from '../../api/assistantApi';

const NAVY = '#202871';
const MUTED = '#5B6473';

const COLOURS: Record<AssistantVerdict['colour'], { main: string; bg: string; border: string }> = {
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

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

function describeCheck(check: AssistantCheck): { text: string; icon: IconName; colour: string } {
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
};

export default function AssistantResultCard({ verdict, onShare }: Props) {
  const colour = COLOURS[verdict.colour];

  return (
    <View style={[styles.card, { backgroundColor: colour.bg, borderColor: colour.border }]}>
      <Text style={[styles.title, { color: colour.main }]}>{verdict.title}</Text>
      {verdict.note ? <Text style={styles.note}>{verdict.note}</Text> : null}

      <View style={styles.checks}>
        {verdict.checks.map((check) => {
          const d = describeCheck(check);
          return (
            <View key={check.source} style={styles.checkRow}>
              <MaterialCommunityIcons name={d.icon} size={20} color={d.colour} />
              <Text style={styles.checkLabel}>{CHECK_LABELS[check.source]}</Text>
              <Text style={[styles.checkStatus, { color: d.colour }]}>{d.text}</Text>
            </View>
          );
        })}
      </View>

      <Text style={styles.disclaimer}>{verdict.disclaimer}</Text>

      <Pressable
        onPress={onShare}
        accessibilityRole="button"
        accessibilityLabel="Share result"
        style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.7 }]}
      >
        <MaterialIcons name="share" size={18} color={NAVY} />
        <Text style={styles.shareText}>Share result</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginTop: 4,
  },
  title: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    marginBottom: 4,
  },
  note: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    lineHeight: 19,
    color: MUTED,
    marginBottom: 6,
  },
  checks: {
    marginTop: 8,
    gap: 10,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkLabel: {
    flex: 1,
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: '#111827',
  },
  checkStatus: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
  },
  disclaimer: {
    marginTop: 14,
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    lineHeight: 17,
    color: MUTED,
  },
  shareBtn: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: NAVY,
    borderRadius: 10,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  shareText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: NAVY,
  },
});
