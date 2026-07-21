import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const NAVY = '#202871';
const MUTED = '#858BBD';

type Props = {
  onScanMessage: () => void;
  onCheckEmployer: () => void;
  onSaferJobs: () => void;
};

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
    >
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={18} color={NAVY} />
      </View>
      <Text style={styles.actionLabel} numberOfLines={1}>
        {label}
      </Text>
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
      <View style={styles.panel}>
        <View style={styles.headingRow}>
          <Ionicons name="shield-checkmark" size={14} color={NAVY} />
          <Text style={styles.heading}>Stay protected</Text>
        </View>
        <Text style={styles.subheading}>Quick checks before you apply or reply</Text>
        <View style={styles.actions}>
          <QuickAction
            icon="chatbox-ellipses-outline"
            label="Scan"
            onPress={onScanMessage}
          />
          <View style={styles.divider} />
          <QuickAction
            icon="business-outline"
            label="Employer"
            onPress={onCheckEmployer}
          />
          <View style={styles.divider} />
          <QuickAction
            icon="sparkles-outline"
            label="Safer jobs"
            onPress={onSaferJobs}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 8,
  },
  panel: {
    backgroundColor: '#F4F5FB',
    borderRadius: 14,
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 4,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  heading: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    color: NAVY,
  },
  subheading: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    color: MUTED,
    paddingHorizontal: 12,
    marginTop: 2,
    marginBottom: 10,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  action: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 6,
  },
  actionPressed: {
    opacity: 0.75,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 11,
    color: NAVY,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: '#D8DCEF',
    marginVertical: 8,
  },
});
