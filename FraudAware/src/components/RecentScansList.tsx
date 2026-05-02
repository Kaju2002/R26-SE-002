import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

type ScanStatus = 'scam' | 'legit';

export type RecentScanItem = {
  id: string;
  status: ScanStatus;
  title: string;
  preview: string;
  timeAgo: string;
};

type Props = {
  scans: RecentScanItem[];
};

const PRIMARY_RED = '#E53535';
const SUCCESS_GREEN = '#3B6D11';
const GREY_TEXT = '#6B7280';

export default function RecentScansList({ scans }: Props) {
  return (
    <View style={styles.wrapper}>
      <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
        {scans.map((item) => (
          <View key={item.id} style={styles.historyRow}>
            <View style={[styles.statusDot, item.status === 'scam' ? styles.dotScam : styles.dotLegit]} />
            <View style={styles.historyBody}>
              <View style={styles.historyTop}>
                <Text style={styles.historyTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.timeAgo}>{item.timeAgo}</Text>
              </View>
              <Text style={styles.historyPreview} numberOfLines={1} ellipsizeMode="tail">
                {item.preview}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    maxHeight: 220,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E8E8',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
    marginRight: 12,
  },
  dotScam: {
    backgroundColor: PRIMARY_RED,
  },
  dotLegit: {
    backgroundColor: SUCCESS_GREEN,
  },
  historyBody: {
    flex: 1,
  },
  historyTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  historyTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  timeAgo: {
    fontSize: 12,
    color: GREY_TEXT,
  },
  historyPreview: {
    fontSize: 13,
    color: GREY_TEXT,
  },
});
