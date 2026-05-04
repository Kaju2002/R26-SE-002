import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import type { DetectStackParamList } from '../navigation/detectStackTypes';

type Props = NativeStackScreenProps<DetectStackParamList, 'JobPost'>;

const BUTTON_NAVY = '#202871';
const GREY_TEXT = '#6B7280';
const GREY_BORDER = '#C8CED6';
const JOB_BLUE = '#0D47A1';
const JOB_BLUE_BG = '#EAF2FF';
const API_URL = 'http://192.168.1.3:8000/predict';

const LOADING_STEPS = [
  '📄 Extracting text from image...',
  '🔍 Analyzing for fraud signals...',
];

export default function JobPostScreen({ navigation }: Props) {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const stepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (stepTimerRef.current) clearTimeout(stepTimerRef.current);
    };
  }, []);

  const pickFromGallery = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setImageUri(result.assets[0].uri);
      setError(null);
    }
  }, []);

  const pickFromCamera = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setImageUri(result.assets[0].uri);
      setError(null);
    }
  }, []);

  const onScan = useCallback(async () => {
    if (!imageUri) return;
    setLoading(true);
    setLoadingStep(0);
    setError(null);

    stepTimerRef.current = setTimeout(() => setLoadingStep(1), 2000);

    try {
      const formData = new FormData();
      formData.append('image', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'job_post.jpg',
      } as any);

      const response = await fetch(API_URL, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const result = await response.json();

      navigation.navigate('JobPostResult', {
        prediction: result.prediction ?? 'Unknown',
        confidence: result.confidence ?? 0,
        legitimate_probability: result.legitimate_probability ?? 0,
        fake_probability: result.fake_probability ?? 0,
        extracted_text: result.extracted_text ?? '',
        message: result.message ?? '',
        imageUri,
      });
    } catch {
      setError('Could not analyze image. Make sure backend is running and try again.');
    } finally {
      if (stepTimerRef.current) clearTimeout(stepTimerRef.current);
      setLoading(false);
    }
  }, [imageUri, navigation]);

  const hasImage = imageUri !== null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerSide}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <MaterialIcons name="arrow-back" size={24} color={BUTTON_NAVY} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Job Post Scanner</Text>
        </View>
        <View style={[styles.headerSide, styles.headerSideRight]}>
          <View style={styles.jobBadge}>
            <MaterialCommunityIcons name="clipboard-search-outline" size={18} color={JOB_BLUE} />
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Info banner */}
        <View style={styles.infoBanner}>
          <MaterialCommunityIcons
            name="information-outline"
            size={20}
            color={JOB_BLUE}
            style={styles.bannerIcon}
          />
          <Text style={styles.bannerText}>
            Upload a screenshot of a job post from LinkedIn, Indeed, or any platform to check for
            fraud signals.
          </Text>
        </View>

        <Text style={styles.sectionLabel}>JOB POST IMAGE</Text>

        {/* Upload zone / Image preview */}
        {hasImage ? (
          <View style={styles.previewWrap}>
            <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="cover" />
            <TouchableOpacity
              style={styles.changeBtn}
              onPress={pickFromGallery}
              disabled={loading}
            >
              <Text style={styles.changeBtnText}>Change Image</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.uploadZone}
            onPress={pickFromGallery}
            activeOpacity={0.75}
            disabled={loading}
          >
            <MaterialCommunityIcons name="image-plus" size={48} color={GREY_BORDER} />
            <Text style={styles.uploadText}>Tap to upload job post image</Text>
            <Text style={styles.uploadSubtext}>JPG or PNG supported</Text>
          </TouchableOpacity>
        )}

        {/* Camera / Gallery buttons */}
        <View style={styles.pickerRow}>
          <TouchableOpacity
            style={[styles.pickerBtn, loading && styles.btnDisabled]}
            onPress={pickFromCamera}
            disabled={loading}
            activeOpacity={0.8}
          >
            <MaterialIcons name="camera-alt" size={18} color={BUTTON_NAVY} style={styles.pickerBtnIcon} />
            <Text style={styles.pickerBtnText}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pickerBtn, loading && styles.btnDisabled]}
            onPress={pickFromGallery}
            disabled={loading}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="image-outline" size={18} color={BUTTON_NAVY} style={styles.pickerBtnIcon} />
            <Text style={styles.pickerBtnText}>Gallery</Text>
          </TouchableOpacity>
        </View>

        {/* Scan button */}
        <TouchableOpacity
          style={[styles.scanBtn, !hasImage && styles.scanBtnDisabled, loading && styles.scanBtnDisabled]}
          onPress={onScan}
          disabled={!hasImage || loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#fff" style={styles.loadingSpinner} />
              <Text style={styles.scanBtnText}>{LOADING_STEPS[loadingStep]}</Text>
            </View>
          ) : (
            <Text style={styles.scanBtnText}>Scan Job Post</Text>
          )}
        </TouchableOpacity>

        {/* Error card */}
        {error ? (
          <View style={styles.errorCard}>
            <MaterialIcons name="error-outline" size={20} color="#DC2626" style={styles.errorIcon} />
            <View style={styles.errorContent}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={onScan} style={styles.retryBtn}>
                <Text style={styles.retryBtnText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E8E8',
    backgroundColor: '#fff',
  },
  headerSide: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingLeft: 4,
  },
  headerSideRight: {
    alignItems: 'flex-end',
    paddingRight: 4,
    paddingLeft: 0,
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: BUTTON_NAVY,
  },
  jobBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: JOB_BLUE_BG,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 36,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: JOB_BLUE_BG,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(13, 71, 161, 0.2)',
    padding: 14,
    marginBottom: 22,
    gap: 10,
  },
  bannerIcon: {
    marginTop: 1,
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: '#1a3a6b',
    fontWeight: '500',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: GREY_TEXT,
    marginBottom: 10,
  },
  uploadZone: {
    height: 220,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: GREY_BORDER,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    marginBottom: 16,
    gap: 10,
  },
  uploadText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  uploadSubtext: {
    fontSize: 12,
    color: GREY_TEXT,
  },
  previewWrap: {
    marginBottom: 16,
  },
  previewImage: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
  },
  changeBtn: {
    alignSelf: 'center',
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  changeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: JOB_BLUE,
    textDecorationLine: 'underline',
  },
  pickerRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 22,
  },
  pickerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: BUTTON_NAVY,
    borderRadius: 10,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  pickerBtnIcon: {
    marginRight: 6,
  },
  pickerBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: BUTTON_NAVY,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  scanBtn: {
    backgroundColor: BUTTON_NAVY,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  scanBtnDisabled: {
    backgroundColor: '#9AA7BD',
  },
  scanBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingSpinner: {
    marginRight: 2,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.3)',
    padding: 14,
    gap: 10,
  },
  errorIcon: {
    marginTop: 1,
  },
  errorContent: {
    flex: 1,
  },
  errorText: {
    fontSize: 13,
    color: '#991B1B',
    lineHeight: 18,
    fontWeight: '500',
    marginBottom: 10,
  },
  retryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#DC2626',
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  retryBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
