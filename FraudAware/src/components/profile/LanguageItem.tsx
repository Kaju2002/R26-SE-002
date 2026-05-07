import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { LanguageItem as LanguageItemData } from '../../../data/profileDetails';

const NAVY = '#202871';
const SUBTLE = '#5B6473';

type Props = {
  item: LanguageItemData;
  onEdit?: () => void;
  showDivider?: boolean;
};

export default function LanguageItem({ item, onEdit, showDivider }: Props) {
  const flagSource = item.flag ?? (item.flagUri ? { uri: item.flagUri } : undefined);

  return (
    <View>
      <View style={styles.row}>
        {flagSource && (
          <Image source={flagSource} style={styles.flag} resizeMode="cover" />
        )}
        <View style={styles.textCol}>
          {/** Language — Poppins Medium 14 */}
          <Text style={styles.name}>{item.name}</Text>
          {/** Proficiency — Poppins Regular 12 */}
          <Text style={styles.proficiency}>{item.proficiency}</Text>
        </View>
        <Pressable
          onPress={onEdit}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${item.name}`}
          style={({ pressed }) => [
            styles.editBtn,
            pressed && { opacity: 0.6 },
          ]}
        >
          <Image
            source={require('../../../assets/icons/edit1.png')}
            style={styles.editIcon}
            resizeMode="contain"
          />
        </Pressable>
      </View>
      {showDivider && <View style={styles.divider} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  flag: {
    width: 36,
    height: 26,
    borderRadius: 4,
    backgroundColor: '#EAECF2',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: NAVY,
    marginBottom: 1,
  },
  proficiency: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: SUBTLE,
  },
  editBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editIcon: {
    width: 16,
    height: 16,
    tintColor: NAVY,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F2F8',
    marginVertical: 4,
  },
});
