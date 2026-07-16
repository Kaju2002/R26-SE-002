import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { InchatMessage } from '../../../data/inchatMessages';
import { INCHAT_BORDER, INCHAT_MUTED, INCHAT_NAVY } from './inchatStyles';

type Props = {
  message: InchatMessage;
};

export default function InchatMessageBubble({ message }: Props) {
  const mine = message.role === 'user';
  const isUnsent = message.unsent === true;
  // FraudAware: warn jobseekers on inbound recruiter messages only.
  const isFlagged = !mine && message.scamAnalysis?.status === 'flagged';

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
        {isFlagged && message.scamAnalysis?.tactics?.length ? (
          <Text style={styles.flagTactics}>Detected: {message.scamAnalysis.tactics.join(', ')}</Text>
        ) : null}
        <Text
          style={[
            styles.time,
            mine && !isFlagged ? styles.timeMine : styles.timeTheirs,
            isFlagged && styles.timeFlagged,
          ]}
        >
          {message.timeLabel}
        </Text>
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
    paddingHorizontal: 14,
    paddingVertical: 10,
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
  time: {
    fontSize: 11,
    marginTop: 6,
    fontWeight: '600',
  },
  timeMine: {
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'right',
  },
  timeTheirs: {
    color: INCHAT_MUTED,
  },
  timeFlagged: {
    color: '#B91C1C',
  },
});
