import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import RecentScanDetailBottomSheet from './ui_component/RecentScanDetailBottomSheet';
import type { RecentScanItem } from './ui_component/recentScanTypes';

export type { RecentScanItem } from './ui_component/recentScanTypes';

type Props = {
  scans: RecentScanItem[];
  /** Per-row delete; parent should confirm and call the API. */
  onDeleteItem?: (scanId: string) => void;
};

const PRIMARY_RED = '#E53535';
const SUCCESS_GREEN = '#3B6D11';
const GREY_TEXT = '#6B7280';
const NAVY = '#202871';

export default function RecentScansList({ scans, onDeleteItem }: Props) {
  const [selected, setSelected] = useState<RecentScanItem | null>(null);

  return (
    <View style={styles.wrapper}>
      <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
        {scans.length === 0 ? (
          <View style={styles.emptyWrap}>
            <MaterialCommunityIcons name="history" size={36} color="#C8CED6" style={styles.emptyIcon} />
            <Text style={styles.emptyText}>No scans yet. Run an analysis to see it here.</Text>
          </View>
        ) : (
          scans.map((item) => (
            <View key={item.id} style={styles.historyRow}>
              <TouchableOpacity
                style={styles.historyRowMain}
                activeOpacity={0.88}
                onPress={() => setSelected(item)}
              >
                <View style={styles.historyBody}>
                  <View style={styles.historyTop}>
                    <View
                      style={[styles.statusPill, item.status === 'scam' ? styles.pillScam : styles.pillLegit]}
                    >
                      <View
                        style={[styles.statusDot, item.status === 'scam' ? styles.dotScam : styles.dotLegit]}
                      />
                      <Text
                        style={[
                          styles.statusPillText,
                          item.status === 'scam' ? styles.pillTextScam : styles.pillTextLegit,
                        ]}
                      >
                        {item.status === 'scam' ? 'Potential scam' : 'Looks legitimate'}
                      </Text>
                    </View>
                    <View style={styles.timeWrap}>
                      <MaterialCommunityIcons name="clock-time-four-outline" size={14} color={GREY_TEXT} />
                      <Text style={styles.timeAgo}>{item.timeAgo}</Text>
                    </View>
                  </View>

                  <Text style={styles.historyTitle} numberOfLines={1}>
                    {item.title}
                  </Text>

                  <Text style={styles.historyPreview} numberOfLines={2} ellipsizeMode="tail">
                    {item.preview}
                  </Text>
                </View>
              </TouchableOpacity>
              {onDeleteItem ? (
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => onDeleteItem(item.id)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  accessibilityRole="button"
                  accessibilityLabel="Delete scan"
                >
                  <MaterialCommunityIcons name="trash-can-outline" size={22} color="#B71C1C" />
                </TouchableOpacity>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>

      <RecentScanDetailBottomSheet
        visible={selected != null}
        item={selected}
        onClose={() => setSelected(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    maxHeight: 290,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
  },
  emptyIcon: {
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 13,
    color: GREY_TEXT,
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '500',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E7ECF3',
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 6,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  historyRowMain: {
    flex: 1,
    minWidth: 0,
  },
  deleteBtn: {
    justifyContent: 'center',
    paddingLeft: 4,
    paddingRight: 6,
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
    marginBottom: 10,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillScam: {
    backgroundColor: '#FDECEC',
  },
  pillLegit: {
    backgroundColor: '#EAF6EC',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  pillTextScam: {
    color: '#B71C1C',
  },
  pillTextLegit: {
    color: '#1B5E20',
  },
  timeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  historyTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: NAVY,
    marginBottom: 6,
  },
  timeAgo: {
    fontSize: 11,
    color: GREY_TEXT,
    fontWeight: '600',
  },
  historyPreview: {
    fontSize: 13,
    color: GREY_TEXT,
    lineHeight: 18,
  },
});
