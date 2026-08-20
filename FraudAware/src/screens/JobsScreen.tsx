import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from '@react-navigation/native';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
} from '@expo-google-fonts/poppins';
import type { Job } from '../../data/jobs';
import type { RootStackParamList } from '../navigation/rootStackParams';
import { getSavedJobs, listJobs, type ListJobsParams } from '../api/jobApi';
import { mapApiJobsToJobs } from '../utils/jobMapper';
import { useBookmarks } from '../context/BookmarksContext';
import { useUser } from '../context/UserContext';
import { useInchat } from '../context/InchatContext';
import { navigateToInchatThread } from '../navigation/navigateToInchatThread';
import JobsSearchHeader from '../components/jobs/search/JobsSearchHeader';
import JobsLoadingState from '../components/jobs/search/JobsLoadingState';
import JobsEmptyState from '../components/jobs/search/JobsEmptyState';
import JobsResultsList from '../components/jobs/search/JobsResultsList';
import JobsSortSheet from '../components/jobs/search/JobsSortSheet';
import JobsFilterSheet from '../components/jobs/search/JobsFilterSheet';
import ForYouRecommendationsSection from '../components/jobs/ForYouRecommendationsSection';
import { useSafeJobRecommendations } from '../hooks/useSafeJobRecommendations';
import {
  DEFAULT_JOB_FILTERS,
  normalizeSalaryCurrency,
  type JobFilters,
  type SortOption,
} from '../components/jobs/search/types';
import { JOB_SEARCH_COLORS } from '../components/jobs/search/jobSearchTheme';

const SEARCH_LOADING_DELAY_MS = 450;

type JobsSegment = 'forYou' | 'recent' | 'saved';
type JobsRouteParams = {
  Jobs:
    | {
        segment?: JobsSegment;
        presetQuery?: string;
        openFilters?: boolean;
      }
    | undefined;
};

function buildListParams(
  segment: JobsSegment,
  query: string,
  filters: JobFilters,
  sort: SortOption
): ListJobsParams {
  const salaryActive = Boolean(filters.currency && filters.salaryEnabled);
  return {
    q: query.trim() || undefined,
    mode: filters.mode || undefined,
    types: filters.types.length > 1 ? filters.types : undefined,
    type: filters.types.length === 1 ? filters.types[0] : undefined,
    location: filters.location.trim() || undefined,
    currency: filters.currency || undefined,
    salaryMin: salaryActive ? filters.salaryMin : undefined,
    salaryMax: salaryActive ? filters.salaryMax : undefined,
    sort: segment === 'forYou' ? 'newly_posted' : sort,
    limit: 50,
  };
}

function sortJobs(jobs: Job[], sort: SortOption): Job[] {
  const sorted = [...jobs];
  sorted.sort((a, b) => {
    if (sort === 'alphabetical') return a.title.localeCompare(b.title);
    if (sort === 'highest_salary') return b.salaryMax - a.salaryMax;
    if (sort === 'ending_soon') {
      return new Date(a.endsAt ?? '').getTime() - new Date(b.endsAt ?? '').getTime();
    }
    return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
  });
  return sorted;
}

function filterJobs(jobs: Job[], query: string, filters: JobFilters): Job[] {
  const q = query.trim().toLowerCase();
  return jobs.filter((job) => {
    const searchHit =
      q.length === 0 ||
      job.title.toLowerCase().includes(q) ||
      job.companyName.toLowerCase().includes(q) ||
      job.location.toLowerCase().includes(q);
    const modeHit = !filters.mode || job.mode === filters.mode;
    const typeHit =
      filters.types.length === 0 || filters.types.includes(job.type);
    const locationHit =
      !filters.location.trim() ||
      job.location.toLowerCase().includes(filters.location.trim().toLowerCase());
    const jobCurrency = normalizeSalaryCurrency(job.salaryCurrency);
    const currencyHit =
      !filters.currency || jobCurrency === filters.currency;
    const salaryHit =
      !filters.currency ||
      !filters.salaryEnabled ||
      (job.salaryMax >= filters.salaryMin &&
        job.salaryMin <= filters.salaryMax);
    return (
      searchHit &&
      modeHit &&
      typeHit &&
      locationHit &&
      currencyHit &&
      salaryHit
    );
  });
}

export default function JobsScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<JobsRouteParams, 'Jobs'>>();
  const { bookmarkedIds, toggleBookmark } = useBookmarks();
  const { token, user } = useUser();
  const { startConversationFromApplication } = useInchat();
  const [segment, setSegment] = useState<JobsSegment>(
    route.params?.segment ?? 'forYou'
  );
  const [query, setQuery] = useState(route.params?.presetQuery ?? '');
  const [showSort, setShowSort] = useState(false);
  const [sortAnchor, setSortAnchor] = useState<{ x: number; y: number } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState<SortOption>('newly_posted');
  const [filters, setFilters] = useState<JobFilters>(DEFAULT_JOB_FILTERS);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [fetching, setFetching] = useState(true);
  const [startingChat, setStartingChat] = useState(false);

  const {
    skills,
    jobs: forYouJobs,
    status: forYouStatus,
    errorMessage: forYouError,
    isLoading: forYouLoading,
    reload: reloadForYou,
  } = useSafeJobRecommendations();

  useEffect(() => {
    if (route.params?.segment) {
      setSegment(route.params.segment);
    }
    if (route.params?.presetQuery !== undefined) {
      setQuery(route.params.presetQuery);
    }
  }, [route.params?.presetQuery, route.params?.segment]);

  useFocusEffect(
    useCallback(() => {
      if (route.params?.openFilters) {
        setShowFilters(true);
        navigation.setParams({ openFilters: false } as never);
      }
      if (segment === 'forYou') {
        void reloadForYou();
      }
    }, [navigation, reloadForYou, route.params?.openFilters, segment])
  );

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
  });

  const loadJobs = useCallback(async () => {
    if (segment === 'forYou') {
      setFetching(false);
      return;
    }

    if (segment === 'saved') {
      if (!token) {
        setJobs([]);
        setFetching(false);
        return;
      }

      setFetching(true);
      try {
        const response = await getSavedJobs(token, { limit: 50 });
        const savedJobs = mapApiJobsToJobs(response.jobs);
        setJobs(sortJobs(filterJobs(savedJobs, query, filters), sort));
      } catch {
        setJobs([]);
      } finally {
        setFetching(false);
      }
      return;
    }

    setFetching(true);
    try {
      const response = await listJobs(
        buildListParams(segment, query, filters, sort)
      );
      setJobs(mapApiJobsToJobs(response.jobs));
    } catch {
      setJobs([]);
    } finally {
      setFetching(false);
    }
  }, [segment, query, filters, sort, token]);

  useEffect(() => {
    if (segment === 'forYou') {
      setFetching(false);
      return;
    }

    const timer = setTimeout(() => {
      void loadJobs();
    }, SEARCH_LOADING_DELAY_MS);

    return () => clearTimeout(timer);
  }, [loadJobs, segment]);

  const isLoading = segment === 'forYou' ? forYouLoading : fetching;
  const visibleJobs =
    segment === 'saved'
      ? jobs.filter((job) => bookmarkedIds.has(job.id))
      : jobs;

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (segment !== 'forYou') setFetching(true);
  };

  const openRecruiterProfile = useCallback(
    ({ recruiterId, jobId }: { recruiterId: string; jobId: string }) => {
      navigation.navigate('RecruiterProfile', { recruiterId, jobId });
    },
    [navigation]
  );

  const onChatPress = useCallback(
    async ({
      recruiterId,
      jobId,
      applicationId,
    }: {
      recruiterId: string;
      jobId: string;
      applicationId?: string;
    }) => {
      if (!applicationId) {
        openRecruiterProfile({ recruiterId, jobId });
        return;
      }
      if (startingChat) return;
      setStartingChat(true);
      try {
        const threadId = await startConversationFromApplication(applicationId);
        navigateToInchatThread(navigation, threadId);
      } catch (err) {
        Alert.alert(
          'Could not start chat',
          err instanceof Error ? err.message : 'Please try again.'
        );
      } finally {
        setStartingChat(false);
      }
    },
    [navigation, openRecruiterProfile, startConversationFromApplication, startingChat]
  );

  if (!fontsLoaded) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={JOB_SEARCH_COLORS.primaryText} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <JobsSearchHeader
        query={query}
        onChangeQuery={handleQueryChange}
        onFilterPress={() => setShowFilters(true)}
      />
      <SegmentTabs value={segment} onChange={setSegment} />

      <View style={styles.content}>
        {segment === 'forYou' ? (
          <ScrollView
            contentContainerStyle={styles.forYouScroll}
            showsVerticalScrollIndicator={false}
          >
            <ForYouRecommendationsSection
              title="For You"
              layout="vertical"
              jobs={forYouJobs}
              skills={skills}
              loading={isLoading}
              status={forYouStatus}
              errorMessage={forYouError}
              onRetry={() => void reloadForYou()}
              onSeeAllPress={() => navigation.navigate('SafeJobRecommendations')}
              onJobPress={(jobId) => navigation.navigate('JobDetails', { jobId })}
              onBookmarkPress={toggleBookmark}
              onChatPress={onChatPress}
              currentUserId={user?.id}
              bookmarkedIds={bookmarkedIds}
              onAddSkillsPress={() => navigation.navigate('Profile')}
            />
          </ScrollView>
        ) : isLoading ? (
          <JobsLoadingState />
        ) : visibleJobs.length === 0 ? (
          <JobsEmptyState />
        ) : (
          <JobsResultsList
            jobs={visibleJobs}
            onJobPress={(jobId) => navigation.navigate('JobDetails', { jobId })}
            bookmarkedIds={bookmarkedIds}
            onBookmarkPress={toggleBookmark}
            onChatPress={onChatPress}
            currentUserId={user?.id}
            onSortPress={(anchor) => {
              setSortAnchor(anchor);
              setShowSort(true);
            }}
          />
        )}
      </View>

      <JobsSortSheet
        visible={showSort}
        value={sort}
        anchor={sortAnchor}
        onClose={() => setShowSort(false)}
        onChange={setSort}
      />
      <JobsFilterSheet
        visible={showFilters}
        value={filters}
        onClose={() => setShowFilters(false)}
        onApply={(next) => {
          setFilters(next);
          setShowFilters(false);
        }}
        onReset={() => setFilters(DEFAULT_JOB_FILTERS)}
      />
    </SafeAreaView>
  );
}

function SegmentTabs({
  value,
  onChange,
}: {
  value: JobsSegment;
  onChange: (segment: JobsSegment) => void;
}) {
  const items: { key: JobsSegment; label: string }[] = [
    { key: 'forYou', label: 'For You' },
    { key: 'recent', label: 'Recent' },
    { key: 'saved', label: 'Saved' },
  ];

  return (
    <View style={styles.segmentRow}>
      {items.map((item) => {
        const active = item.key === value;
        return (
          <Pressable
            key={item.key}
            onPress={() => onChange(item.key)}
            style={[styles.segmentChip, active && styles.segmentChipActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: JOB_SEARCH_COLORS.pageBackground,
  },
  splash: {
    flex: 1,
    backgroundColor: JOB_SEARCH_COLORS.pageBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  forYouScroll: {
    paddingBottom: 24,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  segmentChip: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D6DAEA',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentChipActive: {
    backgroundColor: '#EEF0F8',
    borderColor: '#202871',
  },
  segmentText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: '#858BBD',
  },
  segmentTextActive: {
    color: '#202871',
    fontFamily: 'Poppins_500Medium',
  },
});
