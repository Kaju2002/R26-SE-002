import React from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import LogoFallback from './LogoFallback';
import type { LogoFallbackData } from '../../types/profile';

const NAVY = '#202871';

type Props = {
  label: string;
  logoUri?: string;
  fallback?: LogoFallbackData;
  onImageSelected: (uri: string) => void;
};

export default function EditLogoPicker({
  label,
  logoUri,
  fallback,
  onImageSelected,
}: Props) {
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to upload a logo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      onImageSelected(result.assets[0].uri);
    }
  };

  return (
    <View style={styles.block}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={pickImage}
        accessibilityRole="button"
        accessibilityLabel={`Change ${label}`}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
      >
        {logoUri ? (
          <Image source={{ uri: logoUri }} style={styles.logo} resizeMode="cover" />
        ) : (
          <LogoFallback fallback={fallback} size={56} borderRadius={10} />
        )}
        <Text style={styles.hint}>Tap to upload logo</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    marginBottom: 14,
  },
  label: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: NAVY,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#EAECF2',
  },
  hint: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: '#6B7280',
  },
});
