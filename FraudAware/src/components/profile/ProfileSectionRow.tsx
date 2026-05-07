import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';

const NAVY = '#202871';
const CARD_BORDER = '#D6DBF0';

type Props = {
  label: string;
  icon: ImageSourcePropType;
  onPress?: () => void;
  onAddPress?: () => void;
};

export default function ProfileSectionRow({
  label,
  icon,
  onPress,
  onAddPress,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <Image source={icon} style={styles.icon} resizeMode="contain" />
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={onAddPress ?? onPress}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={`Add ${label}`}
        style={({ pressed }) => [
          styles.addBtn,
          pressed && { opacity: 0.6 },
        ]}
      >
        <Image
          source={require('../../../assets/icons/plusicon.png')}
          style={styles.addIcon}
          resizeMode="contain"
        />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 10,
    height: 50,
    paddingHorizontal: 14,
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  rowPressed: {
    backgroundColor: '#F7F8FE',
  },
  icon: {
    width: 22,
    height: 22,
    tintColor: NAVY,
  },
  /** Section label — Poppins Regular 14 · #202871 */
  label: {
    flex: 1,
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: NAVY,
  },
  addBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIcon: {
    width: 18,
    height: 18,
    tintColor: NAVY,
  },
});
