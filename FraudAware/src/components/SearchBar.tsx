import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import {
  useFonts,
  Poppins_400Regular,
} from '@expo-google-fonts/poppins';

const NAVY = '#202871';
const PLACEHOLDER = '#A8B9CA';
const FIELD_BG = '#EEF0F8';

type Props = {
  value?: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
  onFilterPress?: () => void;
} & Pick<TextInputProps, 'autoFocus' | 'editable' | 'returnKeyType'>;

export default function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search for a job or company',
  onSubmit,
  onFilterPress,
  autoFocus,
  editable = true,
  returnKeyType = 'search',
}: Props) {
  const [fontsLoaded] = useFonts({ Poppins_400Regular });
  const inputFont = fontsLoaded ? 'Poppins_400Regular' : undefined;

  return (
    <View style={styles.wrapper}>
      <View style={styles.field}>
        <Image
          source={require('../../assets/icons/search.png')}
          style={styles.searchIcon}
          resizeMode="contain"
        />
        <TextInput
          style={[styles.input, { fontFamily: inputFont }]}
          placeholder={placeholder}
          placeholderTextColor={PLACEHOLDER}
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmit}
          autoFocus={autoFocus}
          editable={editable}
          returnKeyType={returnKeyType}
          underlineColorAndroid="transparent"
          selectionColor={NAVY}
        />

        <Pressable
          onPress={onFilterPress}
          accessibilityRole="button"
          accessibilityLabel="Filter results"
          hitSlop={8}
          style={({ pressed }) => [
            styles.filterBtn,
            pressed && { opacity: 0.6 },
          ]}
        >
          <Image
            source={require('../../assets/icons/Filter alt.png')}
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
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: FIELD_BG,
    borderRadius: 8,
    height: 48,
    paddingLeft: 14,
    paddingRight: 8,
  },
  searchIcon: {
    width: 18,
    height: 18,
    tintColor: PLACEHOLDER,
    marginRight: 10,
  },
  /** "Search for a job or company" — Poppins Regular 14 · #A8B9CA */
  input: {
    flex: 1,
    fontSize: 14,
    color: NAVY,
    paddingVertical: 0,
  },
  filterBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterIcon: {
    width: 20,
    height: 20,
    tintColor: PLACEHOLDER,
  },
});
