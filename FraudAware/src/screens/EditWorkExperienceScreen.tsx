import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
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
import EditMonthYearField from '../components/profile/EditMonthYearField';
import { buildLogoFallback } from '../utils/logoFallback';
import { formatMonthYear, monthYearToDate, parseMonthYear } from '../utils/formDataHelpers';

const NAVY = '#202871';

export default function EditWorkExperienceScreen() {
  const [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_500Medium });
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'EditWorkExperience'>>();
  const itemId = route.params?.itemId;

  const {
    details,
    addWorkExperience,
    updateWorkExperience,
    deleteWorkExperience,
    isLoading,
  } = useProfile();

  const existing = itemId
    ? details.experiences.find((item) => item.id === itemId)
    : undefined;

  const [role, setRole] = useState('');
  const [company, setCompany] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isCurrentlyWorking, setIsCurrentlyWorking] = useState(false);
  const [description, setDescription] = useState('');
  const [logoUri, setLogoUri] = useState<string | undefined>();
  const [pendingLogoUri, setPendingLogoUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!existing) return;
    setRole(existing.role);
    setCompany(existing.company);
    setLocation(existing.location || '');
    setStartDate(formatMonthYear(existing.startDate));
    setEndDate(formatMonthYear(existing.endDate));
    setIsCurrentlyWorking(Boolean(existing.isCurrentlyWorking));
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
    if (!role.trim() || !company.trim() || !parsedStart) {
      Alert.alert('Missing fields', 'Role, company, and start date (MM/YYYY) are required.');
      return;
    }

    const payload = {
      role: role.trim(),
      company: company.trim(),
      startDate: parsedStart,
      endDate: isCurrentlyWorking ? null : parseMonthYear(endDate),
      isCurrentlyWorking,
      description: description.trim(),
      location: location.trim(),
    };

    try {
      setSaving(true);
      const newLogo = pendingLogoUri ?? undefined;
      if (itemId) {
        await updateWorkExperience(itemId, payload, newLogo);
      } else {
        await addWorkExperience(payload, newLogo);
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert(
        'Save failed',
        err instanceof Error ? err.message : 'Could not save work experience'
      );
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    if (!itemId) return;

    Alert.alert('Delete experience', 'Remove this work experience entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setSaving(true);
            await deleteWorkExperience(itemId);
            navigation.goBack();
          } catch (err) {
            Alert.alert(
              'Delete failed',
              err instanceof Error ? err.message : 'Could not delete work experience'
            );
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const displayLogo = pendingLogoUri || logoUri;
  const fallback = buildLogoFallback(company);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={NAVY} />
        </Pressable>
        <Text style={styles.title}>{itemId ? 'Edit experience' : 'Add experience'}</Text>
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
            label="Company logo"
            logoUri={displayLogo}
            fallback={fallback}
            onImageSelected={setPendingLogoUri}
          />
          <EditProfileField
            label="Job title"
            value={role}
            onChangeText={setRole}
            placeholder="UI/UX Designer"
            autoCapitalize="words"
          />
          <EditProfileField
            label="Company"
            value={company}
            onChangeText={setCompany}
            placeholder="Google LLC"
            autoCapitalize="words"
          />
          <EditProfileField
            label="Location"
            value={location}
            onChangeText={setLocation}
            placeholder="Accra"
            autoCapitalize="words"
          />
          <EditMonthYearField
            label="Start date"
            value={startDate}
            onChange={setStartDate}
            placeholder="01/2020"
            maximumDate={new Date()}
          />
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>I currently work here</Text>
            <Switch
              value={isCurrentlyWorking}
              onValueChange={setIsCurrentlyWorking}
              trackColor={{ false: '#D6DBF0', true: NAVY }}
            />
          </View>
          {!isCurrentlyWorking && (
            <EditMonthYearField
              label="End date"
              value={endDate}
              onChange={setEndDate}
              placeholder="06/2023"
              maximumDate={new Date()}
              minimumDate={
                parseMonthYear(startDate)
                  ? monthYearToDate(startDate)
                  : undefined
              }
            />
          )}
          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput
            style={styles.textArea}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe your responsibilities"
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
              <Text style={styles.deleteBtnText}>Delete experience</Text>
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  switchLabel: { fontFamily: 'Poppins_500Medium', fontSize: 14, color: NAVY },
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
