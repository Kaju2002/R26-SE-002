import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
} from '@expo-google-fonts/poppins';
import {
  useNavigation,
  type NavigationProp,
} from '@react-navigation/native';
import Header from '../components/Header';
import SearchBar from '../components/SearchBar';
import JobsSection from '../components/jobs/JobsSection';
import { RECENT_JOBS, RECOMMENDED_JOBS } from '../../data/jobs';

const NAVY = '#202871';

type HomeNavParams = {
  Jobs: undefined;
  JobDetails: { jobId: string };
};

export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp<HomeNavParams>>();
  const [query, setQuery] = useState('');
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set());

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={NAVY} size="large" />
      </View>
    );
  }

  const toggleBookmark = (id: string) => {
    setBookmarked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const openJobDetails = (jobId: string) => {
    navigation.navigate('JobDetails', { jobId });
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <Header />
      <SearchBar value={query} onChangeText={setQuery} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <JobsSection
          title="Recommended Jobs"
          jobs={RECOMMENDED_JOBS}
          layout="horizontal"
          bookmarkedIds={bookmarked}
          onBookmarkPress={toggleBookmark}
          onJobPress={openJobDetails}
          onSeeAllPress={() => navigation.navigate('Jobs')}
        />
        <JobsSection
          title="Recent Jobs"
          jobs={RECENT_JOBS}
          layout="vertical"
          bookmarkedIds={bookmarked}
          onBookmarkPress={toggleBookmark}
          onJobPress={openJobDetails}
          onSeeAllPress={() => navigation.navigate('Jobs')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  splash: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  content: {
    paddingBottom: 120,
  },
});
