import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useNavigation,
  type NavigationProp,
} from '@react-navigation/native';
import Header from '../components/Header';
import SearchBar from '../components/SearchBar';
import JobsSection from '../components/jobs/JobsSection';
import ForYouRecommendationsSection from '../components/jobs/ForYouRecommendationsSection';
import HomeHeroBanner from '../components/home/HomeHeroBanner';
import type { Job } from '../../data/jobs';
import { listJobs } from '../api/jobApi';
import { mapApiJobsToJobs } from '../utils/jobMapper';
import { useBookmarks } from '../context/BookmarksContext';
import { useUser } from '../context/UserContext';
import { useSafeJobRecommendations } from '../hooks/useSafeJobRecommendations';
import {
  getHomeHeroDismissed,
  markHomeHeroDismissed,
} from '../utils/homeHeroStorage';

const NAVY = '#202871';

const HOME_JOB_FEED_ROWS = [
  { key: 'recommended' as const },
  { key: 'recent' as const },
];

type HomeNavParams = {
  Jobs:
    | {
        segment?: 'forYou' | 'recent' | 'saved';
        presetQuery?: string;
        openFilters?: boolean;
      }
    | undefined;
  Bookmarks: undefined;
  JobDetails: { jobId: string };
  RecruiterProfile: { recruiterId: string; jobId?: string };
  Profile: undefined;
  SafeJobRecommendations: undefined;
};

export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp<HomeNavParams>>();
  const [query, setQuery] = useState('');
  const { bookmarkedIds, toggleBookmark } = useBookmarks();
  const { user } = useUser();
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showHero, setShowHero] = useState(false);

  const {
    skills,
    jobs: forYouJobs,
    status: forYouStatus,
    errorMessage: forYouError,
    isLoading: forYouLoading,
    reload: reloadForYou,
  } = useSafeJobRecommendations(8);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const dismissed = await getHomeHeroDismissed();
      if (!cancelled) setShowHero(!dismissed);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadJobs = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoadingJobs(true);
    setLoadError(false);

    try {
      const recent = await listJobs({ sort: 'newly_posted', limit: 20 });
      setRecentJobs(mapApiJobsToJobs(recent.jobs));
      setLoadError(false);
    } catch {
      setRecentJobs([]);
      setLoadError(true);
    } finally {
      setLoadingJobs(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const dismissHero = useCallback(() => {
    setShowHero(false);
    void markHomeHeroDismissed();
  }, []);

  const openJobDetails = useCallback(
    (jobId: string) => {
      navigation.navigate('JobDetails', { jobId });
    },
    [navigation],
  );

  const openRecruiterProfile = useCallback(
    ({ recruiterId, jobId }: { recruiterId: string; jobId: string }) => {
      navigation.navigate('RecruiterProfile', { recruiterId, jobId });
    },
    [navigation],
  );

  const openSaferJobs = useCallback(() => {
    dismissHero();
    navigation.navigate('SafeJobRecommendations');
  }, [dismissHero, navigation]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        (async () => {
          setLoadError(false);
          try {
            const recent = await listJobs({ sort: 'newly_posted', limit: 20 });
            setRecentJobs(mapApiJobsToJobs(recent.jobs));
          } catch {
            setRecentJobs([]);
            setLoadError(true);
          } finally {
            setLoadingJobs(false);
          }
        })(),
        reloadForYou(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [reloadForYou]);

  const listHeader = showHero ? (
    <HomeHeroBanner onPress={openSaferJobs} onDismiss={dismissHero} />
  ) : null;

  const renderJobFeedRow = useCallback(
    ({ item }: { item: (typeof HOME_JOB_FEED_ROWS)[number] }) => {
      if (item.key === 'recommended') {
        return (
          <ForYouRecommendationsSection
            title="For you"
            layout="horizontal"
            jobs={forYouJobs}
            skills={skills}
            loading={forYouLoading}
            status={forYouStatus}
            errorMessage={forYouError}
            onRetry={() => void reloadForYou()}
            onSeeAllPress={() =>
              navigation.navigate('Jobs', { segment: 'forYou' })
            }
            onJobPress={openJobDetails}
            onBookmarkPress={toggleBookmark}
            onChatPress={openRecruiterProfile}
            currentUserId={user?.id}
            bookmarkedIds={bookmarkedIds}
            onAddSkillsPress={() => navigation.navigate('Profile')}
          />
        );
      }
      return (
        <JobsSection
          title="Latest jobs"
          jobs={recentJobs}
          layout="vertical"
          loading={loadingJobs}
          error={loadError}
          onRetry={() => void loadJobs()}
          emptyMessage="No recent jobs available"
          bookmarkedIds={bookmarkedIds}
          onBookmarkPress={toggleBookmark}
          onJobPress={openJobDetails}
          onChatPress={openRecruiterProfile}
          currentUserId={user?.id}
          onSeeAllPress={() =>
            navigation.navigate('Jobs', { segment: 'recent' })
          }
        />
      );
    },
    [
      bookmarkedIds,
      forYouError,
      forYouJobs,
      forYouLoading,
      forYouStatus,
      loadError,
      loadJobs,
      loadingJobs,
      navigation,
      openJobDetails,
      openRecruiterProfile,
      recentJobs,
      reloadForYou,
      skills,
      toggleBookmark,
      user?.id,
    ],
  );

  const keyExtractorRow = useCallback(
    (row: (typeof HOME_JOB_FEED_ROWS)[number]) => row.key,
    [],
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <View style={styles.stickyTop}>
        <Header onBookmarksPress={() => navigation.navigate('Bookmarks')} />
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Search jobs or companies"
          onFilterPress={() =>
            navigation.navigate('Jobs', {
              segment: 'recent',
              openFilters: true,
            })
          }
          onSubmit={() =>
            navigation.navigate('Jobs', {
              segment: 'recent',
              presetQuery: query.trim(),
            })
          }
        />
      </View>

      <FlatList
        data={HOME_JOB_FEED_ROWS}
        keyExtractor={keyExtractorRow}
        renderItem={renderJobFeedRow}
        ListHeaderComponent={listHeader}
        style={styles.jobScroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        removeClippedSubviews={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={NAVY}
            colors={[NAVY]}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  stickyTop: {
    backgroundColor: '#FFFFFF',
    zIndex: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8EAF4',
  },
  jobScroll: {
    flex: 1,
  },
  content: {
    paddingBottom: 120,
    paddingTop: 4,
  },
});
