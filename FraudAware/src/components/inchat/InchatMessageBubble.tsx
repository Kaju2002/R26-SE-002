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
  return (
    <View style={[styles.wrap, mine ? styles.wrapMine : styles.wrapTheirs]}>
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <Text
          style={[
            styles.body,
            mine ? styles.bodyMine : styles.bodyTheirs,
            isUnsent && styles.bodyUnsent,
          ]}
        >
          {message.body}
        </Text>
        <Text style={[styles.time, mine ? styles.timeMine : styles.timeTheirs]}>{message.timeLabel}</Text>
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
});
