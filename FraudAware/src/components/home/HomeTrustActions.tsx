import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const NAVY = '#202871';
const MUTED = '#858BBD';
const BORDER = '#D6DAEA';

type Props = {
  onScanMessage: () => void;
  onCheckEmployer: () => void;
  onSaferJobs: () => void;
};

function ActionTile({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tile, pressed && { opacity: 0.9 }]}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={17} color={NAVY} />
      </View>
      <View style={styles.textCol}>
        <Text style={styles.tileTitle}>{title}</Text>
        <Text style={styles.tileSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={MUTED} />
    </Pressable>
  );
}

export default function HomeTrustActions({
  onScanMessage,
  onCheckEmployer,
  onSaferJobs,
}: Props) {
  return (
    <View style={styles.wrap}>
      <ActionTile
        icon="chatbox-ellipses-outline"
        title="Scan message"
        subtitle="Check recruiter conversation risk"
        onPress={onScanMessage}
      />
      <ActionTile
        icon="business-outline"
        title="Check employer"
        subtitle="Verify company legitimacy signals"
        onPress={onCheckEmployer}
      />
      <ActionTile
        icon="shield-checkmark-outline"
        title="Safer jobs"
        subtitle="Browse lower-risk recommendations"
        onPress={onSaferJobs}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    gap: 10,
    paddingBottom: 14,
  },
  tile: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    minHeight: 64,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#EEF0F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  tileTitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: NAVY,
  },
  tileSubtitle: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    color: MUTED,
    marginTop: 1,
  },
});
