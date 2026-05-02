import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { RecentScanItem } from './recentScanTypes';

type Props = {
  visible: boolean;
  item: RecentScanItem | null;
  onClose: () => void;
};

const PRIMARY_RED = '#E53535';
const SUCCESS_GREEN = '#3B6D11';
const GREY_TEXT = '#6B7280';
const NAVY = '#202871';
const SHEET_BG = '#fff';

export default function RecentScanDetailBottomSheet({ visible, item, onClose }: Props) {
  if (!item) {
    return null;
  }

  const isScam = item.status === 'scam';
  const accent = isScam ? PRIMARY_RED : SUCCESS_GREEN;
  const confidence =
    typeof item.confidence === 'number' ? `${Math.round(item.confidence)}%` : null;
  const tactics = item.tactics ?? [];
  const bodyNote = isScam ? item.warning : item.reassurance;
  const fullText = item.originalText?.trim() || item.preview;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.grabberWrap}>
            <View style={styles.grabber} />
          </View>

          <View style={styles.sheetHeader}>
            <View style={[styles.statusChip, isScam ? styles.chipScam : styles.chipLegit]}>
              <MaterialCommunityIcons
                name={isScam ? 'shield-alert-outline' : 'shield-check-outline'}
                size={18}
                color={accent}
              />
              <Text style={[styles.chipLabel, { color: accent }]}>
                {isScam ? 'Potential scam' : 'Looks legitimate'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close detail">
              <MaterialCommunityIcons name="close" size={22} color={GREY_TEXT} />
            </TouchableOpacity>
          </View>

          <Text style={styles.headline} numberOfLines={2}>
            {item.title}
          </Text>
          <View style={styles.metaRow}>
            <MaterialCommunityIcons name="clock-time-four-outline" size={14} color={GREY_TEXT} />
            <Text style={styles.metaText}>{item.timeAgo}</Text>
            {confidence ? (
              <>
                <Text style={styles.metaDot}>·</Text>
                <Text style={[styles.metaStrong, { color: accent }]}>{confidence} confidence</Text>
              </>
            ) : null}
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {isScam && tactics.length > 0 ? (
              <>
                <Text style={styles.sectionLabel}>SIGNALS</Text>
                {tactics.map((t, i) => (
                  <View key={`${t.name}-${i}`} style={styles.tacticRow}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={16} color={PRIMARY_RED} style={styles.tacticIcon} />
                    <View style={styles.tacticTextWrap}>
                      <Text style={styles.tacticName}>{t.name}</Text>
                      {t.example ? <Text style={styles.tacticEx}>{t.example}</Text> : null}
                    </View>
                  </View>
                ))}
              </>
            ) : null}

            {bodyNote ? (
              <>
                <Text style={styles.sectionLabel}>{isScam ? 'GUIDANCE' : 'SUMMARY'}</Text>
                <View style={styles.noteCard}>
                  <Text style={styles.noteText}>{bodyNote}</Text>
                </View>
              </>
            ) : null}

            <Text style={styles.sectionLabel}>FULL MESSAGE</Text>
            <View style={styles.messageCard}>
              <Text style={styles.messageBody}>{fullText}</Text>
            </View>
          </ScrollView>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  sheet: {
    backgroundColor: SHEET_BG,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    maxHeight: '88%',
    ...Platform.select({
      android: { elevation: 8 },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
    }),
  },
  grabberWrap: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  chipScam: {
    backgroundColor: '#FDECEC',
  },
  chipLegit: {
    backgroundColor: '#EAF6EC',
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  headline: {
    fontSize: 18,
    fontWeight: '800',
    color: NAVY,
    marginBottom: 8,
    lineHeight: 24,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  metaText: {
    fontSize: 12,
    color: GREY_TEXT,
    fontWeight: '600',
  },
  metaDot: {
    color: GREY_TEXT,
    fontSize: 12,
    fontWeight: '700',
  },
  metaStrong: {
    fontSize: 12,
    fontWeight: '800',
  },
  scroll: {
    maxHeight: 360,
  },
  scrollContent: {
    paddingBottom: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    color: GREY_TEXT,
    marginBottom: 8,
    marginTop: 4,
  },
  tacticRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#FAFBFC',
    borderWidth: 1,
    borderColor: '#E8EDF3',
  },
  tacticIcon: {
    marginTop: 2,
    marginRight: 8,
  },
  tacticTextWrap: {
    flex: 1,
  },
  tacticName: {
    fontSize: 14,
    fontWeight: '800',
    color: NAVY,
    marginBottom: 4,
  },
  tacticEx: {
    fontSize: 13,
    color: GREY_TEXT,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  noteCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E7ECF3',
    padding: 12,
    marginBottom: 16,
  },
  noteText: {
    fontSize: 14,
    color: GREY_TEXT,
    lineHeight: 20,
  },
  messageCard: {
    backgroundColor: '#F3F5F8',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  messageBody: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
  },
  closeBtn: {
    marginTop: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: NAVY,
    backgroundColor: '#fff',
  },
  closeBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: NAVY,
  },
});
