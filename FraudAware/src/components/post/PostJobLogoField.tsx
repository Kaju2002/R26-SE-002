import React from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { POST_JOB } from './postJobTheme';

const LOGO_SIZE = 72;

type Props = {
  imageUri: string | null;
  onImageChange: (uri: string | null) => void;
};

export default function PostJobLogoField({ imageUri, onImageChange }: Props) {
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission needed',
        'Allow photo library access to upload a company logo.'
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
      onImageChange(result.assets[0].uri);
    }
  };

  const clearImage = () => {
    onImageChange(null);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Company logo</Text>
      <Text style={styles.hint}>Optional · Shown on the job card and detail screen</Text>

      <View style={styles.row}>
        <View style={styles.logoBox}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.logoImage} resizeMode="cover" />
          ) : (
            <View style={styles.placeholder}>
              <Ionicons name="business-outline" size={32} color={POST_JOB.mutedLight} />
            </View>
          )}
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={pickImage}
            style={({ pressed }) => [styles.btnSecondary, pressed && { opacity: 0.88 }]}
            accessibilityRole="button"
            accessibilityLabel="Choose company logo image"
          >
            <Text style={styles.btnSecondaryText}>{imageUri ? 'Replace image' : 'Upload logo'}</Text>
          </Pressable>
          {imageUri ? (
            <Pressable
              onPress={clearImage}
              style={({ pressed }) => [styles.btnGhost, pressed && { opacity: 0.88 }]}
              accessibilityRole="button"
            >
              <Text style={styles.btnGhostText}>Remove</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 16,
  },
  label: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: POST_JOB.navy,
    marginBottom: 4,
  },
  hint: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    color: POST_JOB.muted,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  logoBox: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: POST_JOB.border,
    backgroundColor: POST_JOB.inputBg,
  },
  logoImage: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flex: 1,
    gap: 8,
  },
  btnSecondary: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: POST_JOB.navy,
    backgroundColor: POST_JOB.white,
  },
  btnSecondaryText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: POST_JOB.navy,
  },
  btnGhost: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  btnGhostText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: POST_JOB.muted,
  },
});
