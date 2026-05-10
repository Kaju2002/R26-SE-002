import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  View,
  Button,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
} from '@expo-google-fonts/poppins';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PROFILE } from '../../data/profile';
import type { RootStackParamList } from '../../App';
import ProfileTitleBar from '../components/profile/ProfileTitleBar';
import ProfileUserCard from '../components/profile/ProfileUserCard';
import SummarySection from '../components/profile/SummarySection';
import WorkExperienceSection from '../components/profile/WorkExperienceSection';
import EducationSection from '../components/profile/EducationSection';
import SkillsSection from '../components/profile/SkillsSection';
import LanguagesSection from '../components/profile/LanguagesSection';
import CVSection from '../components/profile/CVSection';

const NAVY = '#202871';

export default function ProfileScreen() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
  });

  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  if (!fontsLoaded) {
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
          name={PROFILE.shortName}
          role={PROFILE.role}
          avatar={PROFILE.avatar}
          onEditPress={() => navigation.navigate('EditProfile')}
        />
        <SummarySection />
        <WorkExperienceSection />
        <EducationSection />
        <SkillsSection />
        <LanguagesSection />
        <CVSection />

        <Button
          title="View AI Recommendations"
          onPress={() => navigation.navigate('SafeJobRecommendations')}
        />
      </ScrollView>
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