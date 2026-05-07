import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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
import JobCard from '../components/jobs/JobCard';
import { RECENT_JOBS, RECOMMENDED_JOBS, type Job } from '../../data/jobs';
import { useBookmarks } from '../context/BookmarksContext';
import type { RootStackParamList } from '../navigation/rootStackParams';

const NAVY = '#202871';
const MUTED = '#858BBD';

const ALL_JOBS = [...RECOMMENDED_JOBS, ...RECENT_JOBS];

function getBookmarkedJobs(bookmarkedIds: Set<string>): Job[] {
  return ALL_JOBS.filter((job) => bookmarkedIds.has(job.id));
}

export default function BookmarksScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { bookmarkedIds, toggleBookmark } = useBookmarks();
  const savedJobs = getBookmarkedJobs(bookmarkedIds);

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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="chevron-back" size={24} color={NAVY} />
        </Pressable>
        <Text style={styles.title}>Saved Jobs</Text>
        <View style={styles.headerSpacer} />
      </View>

      {savedJobs.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="bookmark-outline" size={28} color={MUTED} />
          <Text style={styles.emptyTitle}>No saved jobs yet</Text>
          <Text style={styles.emptySub}>
            Tap the bookmark icon on any job card to keep it here.
          </Text>
          <Pressable
            onPress={() => navigation.navigate('MainTabs')}
            style={({ pressed }) => [
              styles.browseBtn,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.browseBtnText}>Browse Jobs</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {savedJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              isBookmarked
              onBookmarkPress={() => toggleBookmark(job.id)}
              onPress={() => navigation.navigate('JobDetails', { jobId: job.id })}
            />
          ))}
        </ScrollView>
      )}
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
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    color: NAVY,
  },
  headerSpacer: {
    width: 36,
    height: 36,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 120,
    gap: 14,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  emptyTitle: {
    marginTop: 12,
    fontFamily: 'Poppins_500Medium',
    fontSize: 18,
    color: NAVY,
  },
  emptySub: {
    marginTop: 8,
    textAlign: 'center',
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    lineHeight: 21,
    color: MUTED,
  },
  browseBtn: {
    marginTop: 16,
    backgroundColor: NAVY,
    borderRadius: 10,
    height: 46,
    minWidth: 150,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  browseBtnText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 15,
    color: '#FFFFFF',
  },
});
