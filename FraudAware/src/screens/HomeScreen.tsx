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
import HomeHeroBanner from '../components/home/HomeHeroBanner';
import type { Job } from '../../data/jobs';
import { listJobs } from '../api/jobApi';
import { mapApiJobsToJobs } from '../utils/jobMapper';
import { useBookmarks } from '../context/BookmarksContext';
import { useUser } from '../context/UserContext';
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
        segment?: 'forYou' | 'recent' | 'saved' | 'applied';
        presetQuery?: string;
        openFilters?: boolean;
      }
    | undefined;
  Bookmarks: undefined;
  JobDetails: { jobId: string };
  RecruiterProfile: { recruiterId: string; jobId?: string };
  SafeJobRecommendations: undefined;
};

export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp<HomeNavParams>>();
  const [query, setQuery] = useState('');
  const { bookmarkedIds, toggleBookmark } = useBookmarks();
  const { user } = useUser();
  const [recommendedJobs, setRecommendedJobs] = useState<Job[]>([]);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showHero, setShowHero] = useState(false);

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
      const [recommended, recent] = await Promise.all([
        listJobs({ sort: 'newly_posted', limit: 10 }),
        listJobs({ sort: 'newly_posted', limit: 20 }),
      ]);
      setRecommendedJobs(mapApiJobsToJobs(recommended.jobs));
      setRecentJobs(mapApiJobsToJobs(recent.jobs));
      setLoadError(false);
    } catch {
      setRecommendedJobs([]);
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

  const listHeader = showHero ? (
    <HomeHeroBanner onPress={openSaferJobs} onDismiss={dismissHero} />
  ) : null;

  const renderJobFeedRow = useCallback(
    ({ item }: { item: (typeof HOME_JOB_FEED_ROWS)[number] }) => {
      if (item.key === 'recommended') {
        return (
          <JobsSection
            title="For you"
            jobs={recommendedJobs}
            layout="horizontal"
            loading={loadingJobs}
            error={loadError}
            onRetry={() => void loadJobs()}
            emptyMessage="No recommendations yet — check back soon"
            bookmarkedIds={bookmarkedIds}
            onBookmarkPress={toggleBookmark}
            onJobPress={openJobDetails}
            onChatPress={openRecruiterProfile}
            currentUserId={user?.id}
            onSeeAllPress={() =>
              navigation.navigate('Jobs', { segment: 'forYou' })
            }
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
      loadError,
      loadJobs,
      loadingJobs,
      navigation,
      openJobDetails,
      openRecruiterProfile,
      recentJobs,
      recommendedJobs,
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
      {/* Sticky chrome: stays fixed while banner + jobs scroll */}
      <View style={styles.stickyTop}>
        <Header onBookmarksPress={() => navigation.navigate('Bookmarks')} />
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Search jobs or companies"
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
            onRefresh={() => void loadJobs(true)}
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
