import React, { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useNavigation,
  type NavigationProp,
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
  const { bookmarkedIds, toggleBookmark } = useBookmarks();
  const [query, setQuery] = useState('');
  const [showSort, setShowSort] = useState(false);
  const [sortAnchor, setSortAnchor] = useState<{ x: number; y: number } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState<SortOption>('newly_posted');
  const [filters, setFilters] = useState<JobFilters>(DEFAULT_JOB_FILTERS);
  const [isSearching, setIsSearching] = useState(false);

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
  });

  const filteredSortedJobs = useMemo(() => {
    const filtered = applyFilters(ALL_JOBS, query, filters);
    return [...filtered].sort((a, b) => bySort(a, b, sort));
  }, [query, filters, sort]);

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
        onBackPress={() => navigation.goBack()}
        onFilterPress={() => setShowFilters(true)}
      />

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
});
