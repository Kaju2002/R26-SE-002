import React from 'react';
import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

const NAVY = '#202871';

type Props = {
  avatar: string;
  onEditPress?: () => void;
  onImageSelected?: (uri: string) => void;
};

export default function EditProfileAvatarPicker({
  avatar,
  onEditPress,
  onImageSelected,
}: Props) {
  const pickImage = async () => {
    if (onEditPress) {
      onEditPress();
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission needed',
        'Allow photo library access to update your profile photo.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      onImageSelected?.(result.assets[0].uri);
    }
  };

  return (
    <View style={styles.wrap}>
      {avatar ? (
        <Image
          source={{ uri: avatar }}
          style={styles.avatar}
          accessibilityLabel="Profile photo"
        />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]} />
      )}
      <Pressable
        onPress={pickImage}
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
  avatarPlaceholder: {
    borderWidth: 1,
    borderColor: '#D6DBF0',
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
