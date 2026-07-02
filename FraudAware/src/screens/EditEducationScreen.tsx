import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
} from '@expo-google-fonts/poppins';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/rootStackParams';
import { useProfile } from '../context/ProfileContext';
import EditProfileField from '../components/profile/EditProfileField';
import EditLogoPicker from '../components/profile/EditLogoPicker';
import { buildLogoFallback } from '../utils/logoFallback';
import { formatMonthYear, parseMonthYear } from '../utils/formDataHelpers';

const NAVY = '#202871';

export default function EditEducationScreen() {
  const [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_500Medium });
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'EditEducation'>>();
  const itemId = route.params?.itemId;

  const { details, addEducation, updateEducation, deleteEducation, isLoading } = useProfile();

  const existing = itemId ? details.education.find((item) => item.id === itemId) : undefined;

  const [degree, setDegree] = useState('');
  const [institution, setInstitution] = useState('');
  const [fieldOfStudy, setFieldOfStudy] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');
  const [logoUri, setLogoUri] = useState<string | undefined>();
  const [pendingLogoUri, setPendingLogoUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!existing) return;
    setDegree(existing.degree);
    setInstitution(existing.institution);
    setFieldOfStudy(existing.fieldOfStudy || '');
    setStartDate(formatMonthYear(existing.startDate));
    setEndDate(formatMonthYear(existing.endDate));
    setDescription(existing.description || '');
    setLogoUri(existing.logoUri);
  }, [existing]);

  if (!fontsLoaded) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={NAVY} size="large" />
      </View>
    );
  }

  const onSave = async () => {
    const parsedStart = parseMonthYear(startDate);
    if (!degree.trim() || !institution.trim() || !parsedStart) {
      Alert.alert('Missing fields', 'Degree, institution, and start date (MM/YYYY) are required.');
      return;
    }

    const payload = {
      degree: degree.trim(),
      institution: institution.trim(),
      fieldOfStudy: fieldOfStudy.trim(),
      startDate: parsedStart,
      endDate: parseMonthYear(endDate) || null,
      description: description.trim(),
    };

    try {
      setSaving(true);
      const newLogo = pendingLogoUri ?? undefined;
      if (itemId) {
        await updateEducation(itemId, payload, newLogo);
      } else {
        await addEducation(payload, newLogo);
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert(
        'Save failed',
        err instanceof Error ? err.message : 'Could not save education'
      );
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    if (!itemId) return;

    Alert.alert('Delete education', 'Remove this education entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setSaving(true);
            await deleteEducation(itemId);
            navigation.goBack();
          } catch (err) {
            Alert.alert(
              'Delete failed',
              err instanceof Error ? err.message : 'Could not delete education'
            );
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const displayLogo = pendingLogoUri || logoUri;
  const fallback = buildLogoFallback(institution);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={NAVY} />
        </Pressable>
        <Text style={styles.title}>{itemId ? 'Edit education' : 'Add education'}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <EditLogoPicker
            label="Institution logo"
            logoUri={displayLogo}
            fallback={fallback}
            onImageSelected={setPendingLogoUri}
          />
          <EditProfileField
            label="Degree"
            value={degree}
            onChangeText={setDegree}
            placeholder="Bachelor of Science"
            autoCapitalize="words"
          />
          <EditProfileField
            label="Institution"
            value={institution}
            onChangeText={setInstitution}
            placeholder="University of Ghana"
            autoCapitalize="words"
          />
          <EditProfileField
            label="Field of study"
            value={fieldOfStudy}
            onChangeText={setFieldOfStudy}
            placeholder="Computer Science"
            autoCapitalize="words"
          />
          <EditProfileField
            label="Start date"
            value={startDate}
            onChangeText={setStartDate}
            placeholder="09/2018"
            keyboardType="numbers-and-punctuation"
          />
          <EditProfileField
            label="End date"
            value={endDate}
            onChangeText={setEndDate}
            placeholder="06/2022"
            keyboardType="numbers-and-punctuation"
          />
          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput
            style={styles.textArea}
            value={description}
            onChangeText={setDescription}
            placeholder="Activities, honors, or notes"
            multiline
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.saveBtn, (saving || isLoading) && styles.saveBtnDisabled]}
            onPress={onSave}
            disabled={saving || isLoading}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveBtnText}>Save</Text>
            )}
          </TouchableOpacity>

          {itemId ? (
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={onDelete}
              disabled={saving || isLoading}
            >
              <Text style={styles.deleteBtnText}>Delete education</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  flex: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 10,
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 18,
    color: NAVY,
    flex: 1,
    marginLeft: 4,
  },
  headerSpacer: { width: 32, height: 32 },
  scrollContent: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 36 },
  fieldLabel: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: NAVY,
    marginBottom: 8,
  },
  textArea: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#D6DBF0',
    borderRadius: 10,
    padding: 12,
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: NAVY,
    marginBottom: 14,
  },
  saveBtn: {
    marginTop: 14,
    backgroundColor: NAVY,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { fontFamily: 'Poppins_400Regular', fontSize: 16, color: '#FFFFFF' },
  deleteBtn: { marginTop: 16, alignItems: 'center', paddingVertical: 10 },
  deleteBtnText: { fontFamily: 'Poppins_500Medium', fontSize: 14, color: '#E63946' },
});
