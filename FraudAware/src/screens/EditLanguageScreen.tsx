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
import EditFlagPicker from '../components/profile/EditFlagPicker';
import { DEFAULT_LANGUAGE_PROFICIENCY, LANGUAGE_PROFICIENCY_OPTIONS, normalizeLanguageProficiency } from '../types/profile';

const NAVY = '#202871';

export default function EditLanguageScreen() {
  const [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_500Medium });
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'EditLanguage'>>();
  const itemId = route.params?.itemId;

  const { details, addLanguage, updateLanguage, deleteLanguage, isLoading } = useProfile();

  const existing = itemId ? details.languages.find((item) => item.id === itemId) : undefined;

  const [name, setName] = useState('');
  const [proficiency, setProficiency] = useState<string>(DEFAULT_LANGUAGE_PROFICIENCY);
  const [flagUri, setFlagUri] = useState<string | undefined>();
  const [pendingFlagUri, setPendingFlagUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!existing) return;
    setName(existing.name);
    setProficiency(normalizeLanguageProficiency(existing.proficiency));
    setFlagUri(existing.flagUri);
  }, [existing]);

  if (!fontsLoaded) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={NAVY} size="large" />
      </View>
    );
  }

  const onSave = async () => {
    if (!name.trim() || !proficiency.trim()) {
      Alert.alert('Missing fields', 'Language name and proficiency are required.');
      return;
    }

    const payload = {
      name: name.trim(),
      proficiency: proficiency.trim(),
    };

    try {
      setSaving(true);
      const newFlag = pendingFlagUri ?? undefined;
      if (itemId) {
        await updateLanguage(itemId, payload, newFlag);
      } else {
        await addLanguage(payload, newFlag);
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert(
        'Save failed',
        err instanceof Error ? err.message : 'Could not save language'
      );
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    if (!itemId) return;

    Alert.alert('Delete language', 'Remove this language?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setSaving(true);
            await deleteLanguage(itemId);
            navigation.goBack();
          } catch (err) {
            Alert.alert(
              'Delete failed',
              err instanceof Error ? err.message : 'Could not delete language'
            );
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={NAVY} />
        </Pressable>
        <Text style={styles.title}>{itemId ? 'Edit language' : 'Add language'}</Text>
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
          <EditProfileField
            label="Language"
            value={name}
            onChangeText={setName}
            placeholder="English"
            autoCapitalize="words"
          />
          <Text style={styles.fieldLabel}>Proficiency</Text>
          <View style={styles.optionList}>
            {LANGUAGE_PROFICIENCY_OPTIONS.map((option) => {
              const selected = proficiency === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => setProficiency(option)}
                  style={[styles.optionRow, selected && styles.optionRowSelected]}
                >
                  <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <EditFlagPicker
            flagUri={pendingFlagUri || flagUri}
            onImageSelected={setPendingFlagUri}
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
              <Text style={styles.deleteBtnText}>Delete language</Text>
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
  optionList: { gap: 8, marginBottom: 14 },
  optionRow: {
    borderWidth: 1,
    borderColor: '#D6DBF0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  optionRowSelected: { backgroundColor: NAVY, borderColor: NAVY },
  optionText: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: NAVY },
  optionTextSelected: { color: '#FFFFFF' },
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
