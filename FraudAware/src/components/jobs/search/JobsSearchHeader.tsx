import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { JOB_SEARCH_COLORS } from './jobSearchTheme';

type Props = {
  query: string;
  onChangeQuery: (value: string) => void;
  onBackPress: () => void;
  onFilterPress: () => void;
};

export default function JobsSearchHeader({
  query,
  onChangeQuery,
  onBackPress,
  onFilterPress,
}: Props) {
  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={onBackPress}
        style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.6 }]}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="chevron-back" size={22} color={JOB_SEARCH_COLORS.primaryText} />
      </Pressable>

      <View style={styles.searchBox}>
        <Image
          source={require('../../../../assets/icons/search.png')}
          style={styles.searchIcon}
          resizeMode="contain"
        />
        <TextInput
          value={query}
          onChangeText={onChangeQuery}
          placeholder="Search jobs"
          placeholderTextColor={JOB_SEARCH_COLORS.mutedText}
          style={styles.input}
          returnKeyType="search"
        />
        <Pressable
          onPress={onFilterPress}
          style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.6 }]}
          accessibilityRole="button"
          accessibilityLabel="Open filter options"
        >
          <Image
            source={require('../../../../assets/icons/Filter alt.png')}
            style={styles.filterIcon}
            resizeMode="contain"
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: JOB_SEARCH_COLORS.pageBackground,
  },
  searchBox: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: JOB_SEARCH_COLORS.primaryText,
    backgroundColor: JOB_SEARCH_COLORS.inputBackground,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
    paddingRight: 4,
  },
  searchIcon: {
    width: 16,
    height: 16,
    tintColor: JOB_SEARCH_COLORS.mutedText,
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: JOB_SEARCH_COLORS.primaryText,
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    paddingVertical: 0,
  },
  iconButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterIcon: {
    width: 18,
    height: 18,
    tintColor: JOB_SEARCH_COLORS.primaryText,
  },
});
