import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { InchatMessage } from '../../../data/inchatMessages';
import { INCHAT_BORDER, INCHAT_MUTED, INCHAT_NAVY } from './inchatStyles';

type Props = {
  message: InchatMessage;
};

type ReceiptStatus = 'sent' | 'delivered' | 'read';

function receiptStatus(message: InchatMessage, mine: boolean): ReceiptStatus | null {
  if (!mine || message.unsent) return null;
  if (message.status === 'delivered' || message.status === 'read' || message.status === 'sent') {
    return message.status;
  }
  // Own messages always show at least a sent tick once they exist in the thread.
  return 'sent';
}

function ReceiptTicks({
  status,
  color,
}: {
  status: ReceiptStatus;
  color: string;
}) {
  if (status === 'sent') {
    return (
      <MaterialCommunityIcons
        name="check"
        size={14}
        color={color}
        accessibilityLabel="Message sent"
        style={styles.receiptIcon}
      />
    );
  }

  return (
    <View
      style={styles.doubleTick}
      accessible
      accessibilityLabel={status === 'read' ? 'Message read' : 'Message delivered'}
    >
      <MaterialCommunityIcons name="check" size={14} color={color} style={styles.receiptIcon} />
      <MaterialCommunityIcons
        name="check"
        size={14}
        color={color}
        style={[styles.receiptIcon, styles.secondTick]}
      />
    </View>
  );
}

export default function InchatMessageBubble({ message }: Props) {
  const mine = message.role === 'user';
  const isUnsent = message.unsent === true;
  // FraudAware: warn jobseekers on inbound recruiter messages only.
  const isFlagged = !mine && message.scamAnalysis?.status === 'flagged';
  const status = receiptStatus(message, mine);
  const compactMeta = !isFlagged && message.body.length <= 28 && !message.body.includes('\n');
  const receiptColor =
    status === 'read' ? '#53BDEB' : mine && !isFlagged ? 'rgba(255,255,255,0.92)' : INCHAT_MUTED;

  return (
    <View style={[styles.wrap, mine ? styles.wrapMine : styles.wrapTheirs]}>
      <View
        style={[
          styles.bubble,
          mine ? styles.bubbleMine : styles.bubbleTheirs,
          isFlagged && styles.bubbleFlagged,
        ]}
      >
        {isFlagged ? (
          <Text style={styles.flagTitle}>
            ⚠ Potential scam
            {message.scamAnalysis?.score !== null && message.scamAnalysis?.score !== undefined
              ? ` · ${Math.round(message.scamAnalysis.score * 100)}% risk`
              : ''}
          </Text>
        ) : null}
        {compactMeta ? (
          <View style={styles.compactRow}>
            <Text
              style={[
                styles.body,
                styles.compactBody,
                mine && !isFlagged ? styles.bodyMine : styles.bodyTheirs,
                isUnsent && styles.bodyUnsent,
              ]}
            >
              {message.body}
            </Text>
            <View style={styles.compactMeta}>
              <Text style={[styles.time, mine ? styles.timeMine : styles.timeTheirs]}>
                {message.timeLabel}
              </Text>
              {status ? <ReceiptTicks status={status} color={receiptColor} /> : null}
            </View>
          </View>
        ) : (
          <Text
            style={[
              styles.body,
              mine && !isFlagged ? styles.bodyMine : styles.bodyTheirs,
              isUnsent && styles.bodyUnsent,
              isFlagged && styles.bodyFlagged,
            ]}
          >
            {message.body}
          </Text>
        )}
        {isFlagged && message.scamAnalysis?.tactics?.length ? (
          <Text style={styles.flagTactics}>Detected: {message.scamAnalysis.tactics.join(', ')}</Text>
        ) : null}

        {!compactMeta ? (
          <View style={styles.metaRow}>
            <Text
              style={[
                styles.time,
                mine && !isFlagged ? styles.timeMine : styles.timeTheirs,
                isFlagged && styles.timeFlagged,
              ]}
            >
              {message.timeLabel}
            </Text>
            {status ? <ReceiptTicks status={status} color={receiptColor} /> : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 10,
    maxWidth: '88%',
  },
  wrapMine: {
    alignSelf: 'flex-end',
  },
  wrapTheirs: {
    alignSelf: 'flex-start',
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    minWidth: 72,
  },
  bubbleMine: {
    backgroundColor: INCHAT_NAVY,
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: '#F3F5F8',
    borderWidth: 1,
    borderColor: INCHAT_BORDER,
    borderBottomLeftRadius: 4,
  },
  bubbleFlagged: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  flagTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#B91C1C',
    marginBottom: 6,
  },
  flagTactics: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DC2626',
    marginTop: 6,
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
    paddingRight: 4,
  },
  bodyMine: {
    color: '#fff',
  },
  bodyTheirs: {
    color: '#1F2937',
  },
  bodyFlagged: {
    color: '#1F2937',
  },
  bodyUnsent: {
    fontStyle: 'italic',
    opacity: 0.8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    alignSelf: 'flex-end',
    marginTop: 4,
    gap: 6,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    flexWrap: 'nowrap',
    gap: 10,
  },
  compactBody: {
    flexShrink: 1,
  },
  compactMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 1,
  },
  time: {
    fontSize: 11,
    fontWeight: '600',
  },
  timeMine: {
    color: 'rgba(255,255,255,0.88)',
  },
  timeTheirs: {
    color: INCHAT_MUTED,
  },
  timeFlagged: {
    color: '#B91C1C',
  },
  doubleTick: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  receiptIcon: {
    marginTop: 1,
  },
  secondTick: {
    marginLeft: -5,
  },
});
