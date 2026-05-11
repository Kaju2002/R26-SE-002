import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { POST_JOB } from './postJobTheme';

export type PostJobFormTab = 'overview' | 'company';

type Props = {
  active: PostJobFormTab;
  onChange: (tab: PostJobFormTab) => void;
};

export default function PostJobOverviewCompanyTabs({ active, onChange }: Props) {
  return (
    <View style={styles.tabsRow}>
      <TabButton
        label="Overview"
        active={active === 'overview'}
        onPress={() => onChange('overview')}
      />
      <TabButton
        label="Company details"
        active={active === 'company'}
        onPress={() => onChange('company')}
      />
    </View>
  );
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={styles.tabBtn}
    >
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
      <View
        style={[
          styles.tabUnderline,
          { backgroundColor: active ? POST_JOB.deep : 'transparent' },
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabsRow: {
    flexDirection: 'row',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: POST_JOB.border,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabLabel: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    color: POST_JOB.muted,
  },
  tabLabelActive: {
    color: POST_JOB.deep,
    fontFamily: 'Poppins_500Medium',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: -1,
    left: 24,
    right: 24,
    height: 2,
    borderRadius: 2,
  },
});
