import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { INCHAT_BORDER, INCHAT_MUTED, INCHAT_NAVY, INCHAT_SEARCH_BG } from './inchatStyles';

type Props = {
  query: string;
  onQueryChange: (q: string) => void;
  /** When false (e.g. Chat tab root), hide back — layout keeps spacer for alignment */
  showBack?: boolean;
  onBack?: () => void;
  onComposePress?: () => void;
};

export default function InchatInboxHeader({
  query,
  onQueryChange,
  showBack = true,
  onBack,
  onComposePress,
}: Props) {
  return (
    <View style={styles.wrap}>
      {showBack ? (
        <Pressable
          onPress={onBack}
          style={styles.iconBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={INCHAT_NAVY} />
        </Pressable>
      ) : (
        <View style={styles.iconBtn} />
      )}

      <View style={styles.searchShell}>
        <MaterialCommunityIcons name="magnify" size={20} color={INCHAT_MUTED} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search messages"
          placeholderTextColor={INCHAT_MUTED}
          value={query}
          onChangeText={onQueryChange}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
      </View>

      <Pressable
        style={styles.iconBtn}
        accessibilityRole="button"
        accessibilityLabel="More options"
        hitSlop={8}
      >
        <MaterialCommunityIcons name="dots-horizontal" size={22} color={INCHAT_NAVY} />
      </Pressable>

      <Pressable
        style={styles.iconBtn}
        onPress={onComposePress}
        accessibilityRole="button"
        accessibilityLabel="New message check"
        hitSlop={8}
      >
        <MaterialCommunityIcons name="square-edit-outline" size={22} color={INCHAT_NAVY} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: INCHAT_BORDER,
    backgroundColor: '#fff',
    ...Platform.select({
      android: { paddingTop: 8 },
    }),
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchShell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: INCHAT_SEARCH_BG,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 4,
    minHeight: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: INCHAT_NAVY,
    paddingVertical: Platform.OS === 'android' ? 8 : 0,
  },
});
