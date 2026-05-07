import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const NAVY = '#202871';
const SUBTLE = '#7A88A6';
const CARD_BORDER = '#D6DBF0';

type Props = {
  name: string;
  role: string;
  avatar: string;
  onEditPress?: () => void;
};

export default function ProfileUserCard({
  name,
  role,
  avatar,
  onEditPress,
}: Props) {
  return (
    <View style={styles.card}>
      <Image
        source={{ uri: avatar }}
        style={styles.avatar}
        accessibilityLabel="Profile photo"
      />
      <View style={styles.textCol}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.role} numberOfLines={1}>
          {role}
        </Text>
      </View>
      <Pressable
        onPress={onEditPress}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Edit profile"
        style={({ pressed }) => [
          styles.editBtn,
          pressed && { opacity: 0.6 },
        ]}
      >
        <Image
          source={require('../../../assets/icons/edit.png')}
          style={styles.editIcon}
          resizeMode="contain"
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 18,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#EAECF2',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  /** Name — Poppins Medium 16 · #202871 */
  name: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    color: NAVY,
    marginBottom: 2,
  },
  /** Role — Poppins Regular 12 · subtle */
  role: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: SUBTLE,
  },
  editBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editIcon: {
    width: 18,
    height: 18,
    tintColor: NAVY,
  },
});
