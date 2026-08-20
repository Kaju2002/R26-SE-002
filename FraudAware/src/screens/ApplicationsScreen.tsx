import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useFocusEffect,
  useNavigation,
  type NavigationProp,
} from '@react-navigation/native';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
} from '@expo-google-fonts/poppins';
import type { Job } from '../../data/jobs';
import Header from '../components/Header';
import JobCard from '../components/jobs/JobCard';
import { getAppliedJobs } from '../api/jobApi';
import { mapAppliedJobsToJobs } from '../utils/jobMapper';
import type { RootStackParamList } from '../navigation/rootStackParams';
import { useUser } from '../context/UserContext';
import { useBookmarks } from '../context/BookmarksContext';
import { useInchat } from '../context/InchatContext';
import { navigateToInchatThread } from '../navigation/navigateToInchatThread';

const NAVY = '#202871';
const MUTED = '#858BBD';

export default function ApplicationsScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { token, user } = useUser();
  const { bookmarkedIds, toggleBookmark } = useBookmarks();
  const { startConversationFromApplication } = useInchat();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [startingChat, setStartingChat] = useState(false);

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
  });

  const loadApplications = useCallback(
    async (isRefresh = false) => {
      if (!token) {
        setJobs([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const response = await getAppliedJobs(token, { limit: 50 });
        setJobs(mapAppliedJobsToJobs(response.jobs, response.applications));
      } catch {
        setJobs([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token]
  );

  useFocusEffect(
    useCallback(() => {
      void loadApplications();
    }, [loadApplications])
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
        navigation.navigate('RecruiterProfile', { recruiterId, jobId });
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
    [navigation, startConversationFromApplication, startingChat]
  );

  const browseJobs = useCallback(() => {
    navigation.navigate('MainTabs', { screen: 'Jobs' } as never);
  }, [navigation]);

  if (!fontsLoaded) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={NAVY} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <Header onBookmarksPress={() => navigation.navigate('Bookmarks')} />
      <View style={styles.titleBlock}>
        <Text style={styles.title}>Applications</Text>
        <Text style={styles.subtitle}>
          {token
            ? jobs.length > 0
              ? `${jobs.length} job${jobs.length === 1 ? '' : 's'} you applied to`
              : 'Track jobs you have applied for'
            : 'Sign in to view your applications'}
        </Text>
      </View>

      {!token ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>Sign in required</Text>
          <Text style={styles.emptyBody}>
            Log in to see application status and message recruiters.
          </Text>
        </View>
      ) : loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={NAVY} size="small" />
        </View>
      ) : jobs.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No applications yet</Text>
          <Text style={styles.emptyBody}>
            Apply to a job from the Jobs tab. Your applications will show up
            here with status updates.
          </Text>
          <Pressable
            onPress={browseJobs}
            style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.actionBtnText}>Browse jobs</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadApplications(true)}
              tintColor={NAVY}
            />
          }
        >
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onPress={() => navigation.navigate('JobDetails', { jobId: job.id })}
              isBookmarked={bookmarkedIds.has(job.id)}
              onBookmarkPress={() => toggleBookmark(job.id)}
              onChatPress={onChatPress}
              currentUserId={user?.id}
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
  titleBlock: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 24,
    color: NAVY,
  },
  subtitle: {
    marginTop: 4,
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: MUTED,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F8FE',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 14,
    backgroundColor: '#F7F8FE',
  },
  emptyBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 48,
    backgroundColor: '#F7F8FE',
  },
  emptyTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    color: NAVY,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    lineHeight: 22,
    color: MUTED,
    textAlign: 'center',
    marginBottom: 20,
  },
  actionBtn: {
    backgroundColor: NAVY,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  actionBtnText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 15,
    color: '#FFFFFF',
  },
});
