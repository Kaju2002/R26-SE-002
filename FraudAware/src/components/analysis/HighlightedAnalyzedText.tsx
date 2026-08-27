import React, { useMemo } from 'react';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';
import type { WordImportance } from '../../utils/coerceWordImportance';
import {
  buildWordHighlightLookup,
  scoreForHighlightedToken,
  segmentAnalyzedText,
} from '../../utils/coerceWordImportance';

const HIGHLIGHT_TEXT = '#991B1B';

type Props = {
  text: string;
  wordImportance?: WordImportance[];
  baseStyle?: TextStyle;
  highlightEnabled?: boolean;
  selectable?: boolean;
};

export default function HighlightedAnalyzedText({
  text,
  wordImportance = [],
  baseStyle,
  highlightEnabled = true,
  selectable,
}: Props) {
  const lookup = useMemo(
    () => buildWordHighlightLookup(wordImportance),
    [wordImportance]
  );

  const segments = useMemo(() => segmentAnalyzedText(text), [text]);

  if (!highlightEnabled || lookup.size === 0) {
    return (
      <Text style={[styles.base, baseStyle]} selectable={selectable}>
        {text}
      </Text>
    );
  }

  return (
    <Text style={[styles.base, baseStyle]} selectable={selectable}>
      {segments.map((part, index) => {
        const score = scoreForHighlightedToken(part, lookup);
        if (score === undefined) {
          return (
            <Text key={`${index}-${part}`} style={baseStyle}>
              {part}
            </Text>
          );
        }
        return (
          <Text
            key={`${index}-${part}`}
            style={[
              styles.highlight,
              baseStyle,
              {
                backgroundColor: '#FECACA',
                color: HIGHLIGHT_TEXT,
              },
            ]}
          >
            {part}
          </Text>
        );
      })}
    </Text>
  );
}

export function WordImportanceChips({
  words,
  accent = HIGHLIGHT_TEXT,
}: {
  words: WordImportance[];
  accent?: string;
}) {
  if (!words.length) {
    return null;
  }

  return (
    <View style={styles.chipRow}>
      {words.slice(0, 6).map((entry) => (
        <Text key={entry.word} style={[styles.chip, { color: accent, borderColor: `${accent}33` }]}>
          {entry.word}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    fontSize: 14,
    lineHeight: 22,
    color: '#374151',
  },
  highlight: {
    fontWeight: '800',
    fontStyle: 'normal',
    borderRadius: 4,
    overflow: 'hidden',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  chip: {
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: '#FFF5F5',
    overflow: 'hidden',
  },
});
