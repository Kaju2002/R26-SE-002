import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
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
import { RECOMMENDED_JOBS, RECENT_JOBS, type Job } from '../../data/jobs';
import type { RootStackParamList } from '../navigation/rootStackParams';
import { useBookmarks } from '../context/BookmarksContext';
import JobsSearchHeader from '../components/jobs/search/JobsSearchHeader';
import JobsLoadingState from '../components/jobs/search/JobsLoadingState';
import JobsEmptyState from '../components/jobs/search/JobsEmptyState';
import JobsResultsList from '../components/jobs/search/JobsResultsList';
import JobsSortSheet from '../components/jobs/search/JobsSortSheet';
import JobsFilterSheet from '../components/jobs/search/JobsFilterSheet';
import {
  DEFAULT_JOB_FILTERS,
  type JobFilters,
  type SortOption,
} from '../components/jobs/search/types';
import { JOB_SEARCH_COLORS } from '../components/jobs/search/jobSearchTheme';

const SEARCH_LOADING_DELAY_MS = 450;
const ALL_JOBS = [...RECOMMENDED_JOBS, ...RECENT_JOBS];
type JobsSegment = 'forYou' | 'recent' | 'saved' | 'applied';
type JobsRouteParams = {
  Jobs:
    | {
        segment?: JobsSegment;
        presetQuery?: string;
        openFilters?: boolean;
      }
    | undefined;
};

function bySort(a: Job, b: Job, sort: SortOption): number {
  if (sort === 'alphabetical') return a.title.localeCompare(b.title);
  if (sort === 'highest_salary') return b.salaryMax - a.salaryMax;
  if (sort === 'newly_posted') {
    return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
  }
  return new Date(a.endsAt ?? '').getTime() - new Date(b.endsAt ?? '').getTime();
}

function applyFilters(jobs: Job[], query: string, filters: JobFilters): Job[] {
  const normalizedQuery = query.trim().toLowerCase();
  return jobs.filter((job) => {
    const searchHit =
      normalizedQuery.length === 0 ||
      job.title.toLowerCase().includes(normalizedQuery) ||
      job.companyName.toLowerCase().includes(normalizedQuery);
    const modeHit = !filters.mode || job.mode === filters.mode;
    const typeHit =
      filters.types.length === 0 || filters.types.includes(job.type);
    const locationHit =
      !filters.location.trim() ||
      job.location.toLowerCase().includes(filters.location.trim().toLowerCase());
    const salaryHit =
      job.salaryMax >= filters.salaryMin && job.salaryMin <= filters.salaryMax;
    return searchHit && modeHit && typeHit && locationHit && salaryHit;
  });
}

export default function JobsScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<JobsRouteParams, 'Jobs'>>();
  const { bookmarkedIds, toggleBookmark } = useBookmarks();
  const [segment, setSegment] = useState<JobsSegment>(
    route.params?.segment ?? 'forYou'
  );
  const [query, setQuery] = useState(route.params?.presetQuery ?? '');
  const [showSort, setShowSort] = useState(false);
  const [sortAnchor, setSortAnchor] = useState<{ x: number; y: number } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState<SortOption>('newly_posted');
  const [filters, setFilters] = useState<JobFilters>(DEFAULT_JOB_FILTERS);
  const [isSearching, setIsSearching] = useState(false);

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
    }, [navigation, route.params?.openFilters])
  );

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
  });

  const baseJobs = useMemo(() => {
    if (segment === 'forYou') return RECOMMENDED_JOBS;
    if (segment === 'recent') return RECENT_JOBS;
    if (segment === 'saved') return ALL_JOBS.filter((job) => bookmarkedIds.has(job.id));
    return ALL_JOBS.filter((job) => Boolean(job.applicationStatus));
  }, [segment, bookmarkedIds]);

  const filteredSortedJobs = useMemo(() => {
    const filtered = applyFilters(baseJobs, query, filters);
    return [...filtered].sort((a, b) => bySort(a, b, sort));
  }, [baseJobs, query, filters, sort]);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setIsSearching(true);
    setTimeout(() => setIsSearching(false), SEARCH_LOADING_DELAY_MS);
  };

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
        {isSearching ? (
          <JobsLoadingState />
        ) : filteredSortedJobs.length === 0 ? (
          <JobsEmptyState />
        ) : (
          <JobsResultsList
            jobs={filteredSortedJobs}
            onJobPress={(jobId) => navigation.navigate('JobDetails', { jobId })}
            bookmarkedIds={bookmarkedIds}
            onBookmarkPress={toggleBookmark}
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
    { key: 'applied', label: 'Applied' },
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
