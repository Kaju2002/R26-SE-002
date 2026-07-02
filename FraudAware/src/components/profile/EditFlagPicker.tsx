import React from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

const NAVY = '#202871';

type Props = {
  flagUri?: string;
  onImageSelected: (uri: string) => void;
};

export default function EditFlagPicker({ flagUri, onImageSelected }: Props) {
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to upload a flag image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 2],
      quality: 0.85,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      onImageSelected(result.assets[0].uri);
    }
  };

  return (
    <View style={styles.block}>
      <Text style={styles.label}>Flag image (optional)</Text>
      <Pressable
        onPress={pickImage}
        accessibilityRole="button"
        accessibilityLabel="Upload flag image"
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
      >
        {flagUri ? (
          <Image source={{ uri: flagUri }} style={styles.flag} resizeMode="cover" />
        ) : (
          <View style={styles.flagPlaceholder}>
            <Text style={styles.placeholderText}>Flag</Text>
          </View>
        )}
        <Text style={styles.hint}>Tap to upload from phone</Text>
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
  flag: {
    width: 54,
    height: 36,
    borderRadius: 4,
    backgroundColor: '#EAECF2',
  },
  flagPlaceholder: {
    width: 54,
    height: 36,
    borderRadius: 4,
    backgroundColor: '#EAECF2',
    borderWidth: 1,
    borderColor: '#D6DBF0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    color: '#9AA1B5',
  },
  hint: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: '#6B7280',
  },
});
