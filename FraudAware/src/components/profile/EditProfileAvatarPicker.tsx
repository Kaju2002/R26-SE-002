import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

const NAVY = '#202871';

type Props = {
  avatar: string;
  onEditPress?: () => void;
};

export default function EditProfileAvatarPicker({
  avatar,
  onEditPress,
}: Props) {
  return (
    <View style={styles.wrap}>
      <Image
        source={{ uri: avatar }}
        style={styles.avatar}
        accessibilityLabel="Profile photo"
      />
      <Pressable
        onPress={onEditPress}
        accessibilityRole="button"
        accessibilityLabel="Change profile photo"
        hitSlop={8}
        style={({ pressed }) => [
          styles.editBtn,
          pressed && { opacity: 0.85 },
        ]}
      >
        <Image
          source={require('../../../assets/icons/Frame 188.png')}
          style={styles.editIcon}
          resizeMode="contain"
        />
      </Pressable>
    </View>
  );
}

const AVATAR_SIZE = 96;
const EDIT_SIZE = 32;

const styles = StyleSheet.create({
  wrap: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    alignSelf: 'center',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: '#EAECF2',
  },
  editBtn: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: EDIT_SIZE,
    height: EDIT_SIZE,
    borderRadius: EDIT_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editIcon: {
    width: EDIT_SIZE,
    height: EDIT_SIZE,
  },
});
