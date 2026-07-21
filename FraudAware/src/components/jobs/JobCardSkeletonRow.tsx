import React from 'react';
import { StyleSheet, View } from 'react-native';

const TRACK = '#EEF0F8';
const BLOCK = '#E2E5F2';

type Props = {
  layout?: 'horizontal' | 'vertical';
  count?: number;
};

function SkeletonCard({ wide }: { wide?: boolean }) {
  return (
    <View style={[styles.card, wide && styles.cardWide]}>
      <View style={styles.row}>
        <View style={styles.avatar} />
        <View style={styles.lines}>
          <View style={[styles.line, styles.lineTitle]} />
          <View style={[styles.line, styles.lineSub]} />
        </View>
      </View>
      <View style={[styles.line, styles.lineBody]} />
      <View style={[styles.line, styles.lineBodyShort]} />
      <View style={styles.chips}>
        <View style={styles.chip} />
        <View style={styles.chip} />
      </View>
    </View>
  );
}

/** Grey placeholder cards while jobs load. */
export default function JobCardSkeletonRow({
  layout = 'horizontal',
  count = 2,
}: Props) {
  if (layout === 'horizontal') {
    return (
      <View style={styles.hRow}>
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonCard key={i} wide />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.vCol}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  hRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 14,
    paddingBottom: 8,
  },
  vCol: {
    paddingHorizontal: 16,
    gap: 14,
  },
  card: {
    backgroundColor: TRACK,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    minHeight: 160,
  },
  cardWide: {
    width: 280,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: BLOCK,
  },
  lines: {
    flex: 1,
    gap: 8,
  },
  line: {
    height: 10,
    borderRadius: 6,
    backgroundColor: BLOCK,
  },
  lineTitle: {
    width: '70%',
    height: 12,
  },
  lineSub: {
    width: '45%',
  },
  lineBody: {
    width: '100%',
  },
  lineBodyShort: {
    width: '55%',
  },
  chips: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  chip: {
    width: 64,
    height: 22,
    borderRadius: 11,
    backgroundColor: BLOCK,
  },
});
