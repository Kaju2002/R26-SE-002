import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const NAVY = '#202871';
const INACTIVE = '#A7ACD7';
const DIVIDER = '#E5E7EE';

export type NotificationTabId = 'general' | 'applications';

type TabDef = {
  id: NotificationTabId;
  label: string;
};

const TABS: TabDef[] = [
  { id: 'general', label: 'General' },
  { id: 'applications', label: 'Applications' },
];

type Props = {
  active: NotificationTabId;
  onChange: (id: NotificationTabId) => void;
};

export default function NotificationsTabs({ active, onChange }: Props) {
  return (
    <View style={styles.row}>
      {TABS.map((t) => {
        const isActive = t.id === active;
        return (
          <Pressable
            key={t.id}
            onPress={() => onChange(t.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            style={styles.tab}
          >
            <Text style={[styles.label, isActive ? styles.labelActive : styles.labelInactive]}>
              {t.label}
            </Text>
            <View
              style={[
                styles.underline,
                isActive ? styles.underlineActive : styles.underlineInactive,
              ]}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: 24,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 8,
  },
  /** Tab label — Poppins Regular 16 */
  label: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    paddingBottom: 10,
    letterSpacing: 0.1,
  },
  labelActive: {
    color: NAVY,
  },
  labelInactive: {
    color: INACTIVE,
  },
  underline: {
    height: 2,
    width: '100%',
  },
  underlineActive: {
    backgroundColor: NAVY,
  },
  underlineInactive: {
    backgroundColor: DIVIDER,
  },
});
