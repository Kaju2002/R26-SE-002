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
  icon: ImageSourcePropType;
  label: string;
  onAdd?: () => void;
  onEdit?: () => void;
  children?: React.ReactNode;
};

export default function ProfileSectionCard({
  icon,
  label,
  onAdd,
  onEdit,
  children,
}: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Image source={icon} style={styles.headerIcon} resizeMode="contain" />
        <Text style={styles.headerLabel}>{label}</Text>
        {onAdd && (
          <Pressable
            onPress={onAdd}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={`Add ${label}`}
            style={({ pressed }) => [
              styles.headerBtn,
              pressed && { opacity: 0.6 },
            ]}
          >
            <Image
              source={require('../../../assets/icons/plusicon.png')}
              style={styles.headerBtnIcon}
              resizeMode="contain"
            />
          </Pressable>
        )}
        {onEdit && !onAdd && (
          <Pressable
            onPress={onEdit}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${label}`}
            style={({ pressed }) => [
              styles.headerBtn,
              pressed && { opacity: 0.6 },
            ]}
          >
            <Image
              source={require('../../../assets/icons/edit1.png')}
              style={styles.headerBtnIcon}
              resizeMode="contain"
            />
          </Pressable>
        )}
      </View>
      <View style={styles.divider} />
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 14,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  headerIcon: {
    width: 20,
    height: 20,
    tintColor: NAVY,
  },
  /** Section header — Poppins Medium 14 · #202871 */
  headerLabel: {
    flex: 1,
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: NAVY,
  },
  headerBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnIcon: {
    width: 18,
    height: 18,
    tintColor: NAVY,
  },
  divider: {
    height: 1,
    backgroundColor: '#EEF0F8',
  },
  body: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
  },
});
