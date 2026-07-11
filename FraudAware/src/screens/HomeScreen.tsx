import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
import HomeTrustTagline from '../components/home/HomeTrustTagline';
import HomeTrustActions from '../components/home/HomeTrustActions';
import HomeProfileCompletionCard from '../components/home/HomeProfileCompletionCard';
import HomeCategoryChips, {
  type HomeCategory,
} from '../components/home/HomeCategoryChips';
import type { Job } from '../../data/jobs';
import { listJobs } from '../api/jobApi';
import { mapApiJobsToJobs } from '../utils/jobMapper';
import { useBookmarks } from '../context/BookmarksContext';

const NAVY = '#202871';

const HOME_JOB_FEED_ROWS = [
  { key: 'recommended' as const },
  { key: 'recent' as const },
];

type HomeNavParams = {
  Jobs:
    | {
        segment?: 'forYou' | 'recent' | 'saved' | 'applied';
        presetQuery?: string;
        openFilters?: boolean;
      }
    | undefined;
  Bookmarks: undefined;
  JobDetails: { jobId: string };
  EditProfile: undefined;
};

export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp<HomeNavParams>>();
  const tabNavigation = useNavigation<any>();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<HomeCategory>('All');
  const { bookmarkedIds, toggleBookmark } = useBookmarks();
  const [recommendedJobs, setRecommendedJobs] = useState<Job[]>([]);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [recommended, recent] = await Promise.all([
          listJobs({ sort: 'newly_posted', limit: 10 }),
          listJobs({ sort: 'newly_posted', limit: 20 }),
        ]);

        if (cancelled) return;

        setRecommendedJobs(mapApiJobsToJobs(recommended.jobs));
        setRecentJobs(mapApiJobsToJobs(recent.jobs));
      } catch {
        if (!cancelled) {
          setRecommendedJobs([]);
          setRecentJobs([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const openJobDetails = useCallback(
    (jobId: string) => {
      navigation.navigate('JobDetails', { jobId });
    },
    [navigation],
  );

  const renderJobFeedRow = useCallback(
    ({ item }: { item: (typeof HOME_JOB_FEED_ROWS)[number] }) => {
      if (item.key === 'recommended') {
        return (
          <JobsSection
            title="Recommended Jobs"
            jobs={recommendedJobs}
            layout="horizontal"
            bookmarkedIds={bookmarkedIds}
            onBookmarkPress={toggleBookmark}
            onJobPress={openJobDetails}
            onSeeAllPress={() =>
              navigation.navigate('Jobs', { segment: 'forYou' })
            }
          />
        );
      }
      return (
        <JobsSection
          title="Recent Jobs"
          jobs={recentJobs}
          layout="vertical"
          bookmarkedIds={bookmarkedIds}
          onBookmarkPress={toggleBookmark}
          onJobPress={openJobDetails}
          onSeeAllPress={() =>
            navigation.navigate('Jobs', { segment: 'recent' })
          }
        />
      );
    },
    [
      bookmarkedIds,
      navigation,
      openJobDetails,
      recentJobs,
      recommendedJobs,
      toggleBookmark,
    ],
  );

  const keyExtractorRow = useCallback(
    (row: (typeof HOME_JOB_FEED_ROWS)[number]) => row.key,
    [],
  );

  if (!fontsLoaded) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={NAVY} size="large" />
      </View>
    );
  }

  const openJobsWithCategory = (category: HomeCategory) => {
    setActiveCategory(category);
    const presetQuery = category === 'All' ? '' : category;
    navigation.navigate('Jobs', {
      segment: 'forYou',
      presetQuery,
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <Header onBookmarksPress={() => navigation.navigate('Bookmarks')} />
      <SearchBar
        value={query}
        onChangeText={setQuery}
        onFilterPress={() =>
          navigation.navigate('Jobs', {
            segment: 'forYou',
            openFilters: true,
          })
        }
        onSubmit={() =>
          navigation.navigate('Jobs', {
            segment: 'forYou',
            presetQuery: query.trim(),
          })
        }
      />
      <HomeTrustTagline />
      <HomeTrustActions
        onScanMessage={() =>
          tabNavigation.navigate('Detect', {
            screen: 'MessageAnalyzer',
          })
        }
        onCheckEmployer={() =>
          tabNavigation.navigate('Detect', {
            screen: 'EmployerCheckScreen',
          })
        }
        onSaferJobs={() =>
          navigation.navigate('Jobs', {
            segment: 'forYou',
          })
        }
      />
      <HomeProfileCompletionCard
        onCompletePress={() => navigation.navigate('EditProfile')}
      />
      <HomeCategoryChips
        active={activeCategory}
        onSelect={(cat) => openJobsWithCategory(cat)}
      />
      <FlatList
        data={HOME_JOB_FEED_ROWS}
        keyExtractor={keyExtractorRow}
        renderItem={renderJobFeedRow}
        style={styles.jobScroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        removeClippedSubviews={false}
      />
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
  jobScroll: {
    flex: 1,
  },
  content: {
    paddingBottom: 120,
  },
});
