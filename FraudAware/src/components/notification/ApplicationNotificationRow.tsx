import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LogoFallback from '../profile/LogoFallback';
import ApplicationStatusBadge from './ApplicationStatusBadge';
import type { ApplicationListItem } from '../../../data/applicationNotifications';

const NAVY = '#202871';
const COMPANY = '#858BBD';
const DIVIDER = '#EEF0F8';

type Props = {
  item: ApplicationListItem;
  showDivider?: boolean;
  onPress?: () => void;
};

export default function ApplicationNotificationRow({
  item,
  showDivider,
  onPress,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.jobTitle} at ${item.companyName}`}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <LogoFallback
        source={item.logo}
        fallback={item.fallback}
        size={44}
        borderRadius={10}
      />

      <View style={styles.textCol}>
        <Text style={styles.jobTitle} numberOfLines={1}>
          {item.jobTitle}
        </Text>
        <Text style={styles.company} numberOfLines={1}>
          {item.companyName}
        </Text>
        <ApplicationStatusBadge status={item.status} />
      </View>

      <Ionicons name="chevron-forward" size={20} color="#9AA7BD" style={styles.chevron} />

      {showDivider && <View style={styles.divider} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  rowPressed: {
    backgroundColor: '#F7F8FE',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  /** Job title — Poppins Medium 14 · #202871 */
  jobTitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: NAVY,
  },
  /** Company — Poppins Regular 12 · #858BBD */
  company: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: COMPANY,
  },
  chevron: {
    marginLeft: 4,
  },
  divider: {
    position: 'absolute',
    left: 20,
    right: 0,
    bottom: 0,
    height: 1,
    backgroundColor: DIVIDER,
  },
});
