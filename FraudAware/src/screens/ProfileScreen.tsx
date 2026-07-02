import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
} from '@expo-google-fonts/poppins';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/rootStackParams';
import * as DocumentPicker from 'expo-document-picker';
import { useProfile } from '../context/ProfileContext';
import ProfileTitleBar from '../components/profile/ProfileTitleBar';
import ProfileUserCard from '../components/profile/ProfileUserCard';
import SummarySection from '../components/profile/SummarySection';
import WorkExperienceSection from '../components/profile/WorkExperienceSection';
import EducationSection from '../components/profile/EducationSection';
import SkillsSection from '../components/profile/SkillsSection';
import LanguagesSection from '../components/profile/LanguagesSection';
import CVSection from '../components/profile/CVSection';
import ProfileEditBottomSheet from '../components/profile/ProfileEditBottomSheet';

const NAVY = '#202871';

export default function ProfileScreen() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
  });

  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { profile, details, isLoading, fetchProfile, updateSummary, updateSkills, uploadCv, deleteCv } =
    useProfile();

  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [skillsModalOpen, setSkillsModalOpen] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState('');
  const [skillsDraft, setSkillsDraft] = useState('');
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchProfile().catch(() => {});
    }, [fetchProfile])
  );

  const openSummaryEdit = () => {
    setSummaryDraft(details.summary);
    setSummaryModalOpen(true);
  };

  const openSkillsEdit = () => {
    setSkillsDraft(details.skills.join(', '));
    setSkillsModalOpen(true);
  };

  const saveSummary = async () => {
    try {
      setSaving(true);
      await updateSummary(summaryDraft.trim());
      setSummaryModalOpen(false);
    } catch (err) {
      Alert.alert(
        'Update failed',
        err instanceof Error ? err.message : 'Could not update summary'
      );
    } finally {
      setSaving(false);
    }
  };

  const saveSkills = async () => {
    const skills = skillsDraft
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      setSaving(true);
      await updateSkills(skills);
      setSkillsModalOpen(false);
    } catch (err) {
      Alert.alert(
        'Update failed',
        err instanceof Error ? err.message : 'Could not update skills'
      );
    } finally {
      setSaving(false);
    }
  };

  const openWorkExperience = (itemId?: string) => {
    navigation.navigate('EditWorkExperience', itemId ? { itemId } : undefined);
  };

  const openEducation = (itemId?: string) => {
    navigation.navigate('EditEducation', itemId ? { itemId } : undefined);
  };

  const openLanguage = (itemId?: string) => {
    navigation.navigate('EditLanguage', itemId ? { itemId } : undefined);
  };

  const pickAndUploadCv = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      if (!asset.uri) return;

      setSaving(true);
      await uploadCv(
        asset.uri,
        asset.name || 'resume.pdf',
        asset.mimeType || 'application/pdf',
        details.cvFiles.length === 0
      );
    } catch (err) {
      Alert.alert(
        'Upload failed',
        err instanceof Error ? err.message : 'Could not upload CV'
      );
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteCv = (cvId: string, name: string) => {
    Alert.alert('Remove CV', `Delete ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setSaving(true);
            await deleteCv(cvId);
          } catch (err) {
            Alert.alert(
              'Delete failed',
              err instanceof Error ? err.message : 'Could not delete CV'
            );
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const openCvFile = (cvId: string) => {
    const file = details.cvFiles.find((item) => item.id === cvId);
    if (!file?.fileUrl) {
      Alert.alert('Unavailable', 'This CV file has no download link yet.');
      return;
    }
    Linking.openURL(file.fileUrl).catch(() => {
      Alert.alert('Open failed', 'Could not open the CV file.');
    });
  };

  if (!fontsLoaded) {
    return (
      <View style={styles.fontSplash}>
        <ActivityIndicator color={NAVY} size="large" />
      </View>
    );
  }

  if (isLoading && !profile) {
    return (
      <View style={styles.fontSplash}>
        <ActivityIndicator color={NAVY} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ProfileTitleBar
        onBackPress={
          navigation.canGoBack() ? () => navigation.goBack() : undefined
        }
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ProfileUserCard
          name={profile?.shortName || profile?.fullName || 'User'}
          role={profile?.role || ''}
          avatar={profile?.avatar || ''}
          onEditPress={() => navigation.navigate('EditProfile')}
        />
        <SummarySection text={details.summary} onEdit={openSummaryEdit} />
        <WorkExperienceSection
          items={details.experiences}
          onAdd={() => openWorkExperience()}
          onItemEdit={openWorkExperience}
        />
        <EducationSection
          items={details.education}
          onAdd={() => openEducation()}
          onItemEdit={openEducation}
        />
        <SkillsSection skills={details.skills} onAdd={openSkillsEdit} />
        <LanguagesSection
          items={details.languages}
          onAdd={() => openLanguage()}
          onItemEdit={openLanguage}
        />
        <CVSection
          files={details.cvFiles}
          onEdit={pickAndUploadCv}
          onRemove={(id) => {
            const file = details.cvFiles.find((item) => item.id === id);
            if (file) confirmDeleteCv(id, file.name);
          }}
          onPressFile={openCvFile}
        />

        <Button
          title="View AI Recommendations"
          onPress={() => navigation.navigate('SafeJobRecommendations')}
        />
      </ScrollView>

      <ProfileEditBottomSheet
        visible={summaryModalOpen}
        title="Edit summary"
        value={summaryDraft}
        onChangeText={setSummaryDraft}
        placeholder="Write a short professional summary"
        saving={saving}
        onClose={() => setSummaryModalOpen(false)}
        onSave={saveSummary}
      />

      <ProfileEditBottomSheet
        visible={skillsModalOpen}
        title="Edit skills"
        hint="Separate skills with commas"
        value={skillsDraft}
        onChangeText={setSkillsDraft}
        placeholder="React Native, Node.js, MongoDB"
        saving={saving}
        onClose={() => setSkillsModalOpen(false)}
        onSave={saveSkills}
      />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  fontSplash: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingTop: 4,
    paddingBottom: 40,
    backgroundColor: '#FBFBFE',
  },
});
