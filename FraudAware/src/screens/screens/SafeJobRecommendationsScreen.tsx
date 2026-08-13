import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../navigation/rootStackParams';
import { useBookmarks } from '../../context/BookmarksContext';
import { useUser } from '../../context/UserContext';
import {
  useSafeJobRecommendations,
  type RankedJob,
} from '../../hooks/useSafeJobRecommendations';
import JobCard from '../../components/jobs/JobCard';

const NAVY = '#202871';
const MUTED = '#6B7280';

export default function SafeJobRecommendationsScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { bookmarkedIds, toggleBookmark } = useBookmarks();
  const { user } = useUser();

  const {
    skills,
    jobs,
    status: loadState,
    errorMessage,
    isLoading,
    reload: loadRecommendations,
  } = useSafeJobRecommendations();

  const openJob = useCallback(
    (jobId: string) => {
      navigation.navigate('JobDetails', { jobId });
    },
    [navigation]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backText}>← Back</Text>
        </Pressable>

        <Text style={styles.heading}>AI Safe Job Recommendations</Text>
        <Text style={styles.subHeading}>
          Personalized matches from your live job board + profile skills
        </Text>

        {skills.length > 0 ? (
          <Text style={styles.skillsUsed} numberOfLines={2}>
            Based on: {skills.join(', ')}
          </Text>
        ) : null}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={NAVY} />
          <Text style={styles.statusHint}>Finding safer matches…</Text>
        </View>
      ) : loadState === 'needs_skills' ? (
        <View style={styles.center}>
          <Text style={styles.stateTitle}>Add skills to get matches</Text>
          <Text style={styles.stateBody}>
            Recommendations use the skills on your profile. Add a few skills,
            then come back here.
          </Text>
          <Pressable
            onPress={() => navigation.navigate('Profile')}
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.primaryBtnText}>Go to Profile</Text>
          </Pressable>
        </View>
      ) : loadState === 'error' ? (
        <View style={styles.center}>
          <Text style={styles.stateTitle}>Couldn’t load recommendations</Text>
          <Text style={styles.stateBody}>
            {errorMessage ?? 'Check that job-management and job-recommendation are running.'}
          </Text>
          <Pressable
            onPress={() => void loadRecommendations()}
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.primaryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : jobs.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.stateTitle}>No matches yet</Text>
          <Text style={styles.stateBody}>
            Try adding skills that appear on your posted jobs, then refresh.
          </Text>
          <Pressable
            onPress={() => navigation.navigate('Profile')}
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.primaryBtnText}>Update skills</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => <RankedJobRow job={item} onPress={openJob} bookmarkedIds={bookmarkedIds} onBookmarkPress={toggleBookmark} currentUserId={user?.id} />}
        />
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Powered by Fraud-Aware AI Recommendation Engine
        </Text>
      </View>
    </SafeAreaView>
  );
}

function RankedJobRow({
  job,
  onPress,
  bookmarkedIds,
  onBookmarkPress,
  currentUserId,
}: {
  job: RankedJob;
  onPress: (jobId: string) => void;
  bookmarkedIds: Set<string>;
  onBookmarkPress: (jobId: string) => void;
  currentUserId?: string | null;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rankBadge}>
        <Text style={styles.rankText}>#{job.rank}</Text>
      </View>
      <JobCard
        job={job}
        isBookmarked={bookmarkedIds.has(job.id)}
        onPress={() => onPress(job.id)}
        onBookmarkPress={() => onBookmarkPress(job.id)}
        currentUserId={currentUserId}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FD',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    backgroundColor: '#F5F7FD',
  },
  statusHint: {
    marginTop: 12,
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: MUTED,
  },
  stateTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    color: NAVY,
    textAlign: 'center',
    marginBottom: 8,
  },
  stateBody: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    lineHeight: 22,
    color: MUTED,
    textAlign: 'center',
    marginBottom: 20,
  },
  primaryBtn: {
    minWidth: 160,
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  backText: {
    fontFamily: 'Poppins_500Medium',
    color: NAVY,
    fontSize: 14,
  },
  heading: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 22,
    color: NAVY,
  },
  subHeading: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: MUTED,
    marginTop: 4,
  },
  skillsUsed: {
    marginTop: 10,
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: NAVY,
    lineHeight: 18,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
    gap: 14,
  },
  row: {
    width: '100%',
  },
  rankBadge: {
    alignSelf: 'flex-start',
    backgroundColor: NAVY,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 8,
  },
  rankText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
    color: '#FFFFFF',
  },
  footer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    alignItems: 'center',
  },
  footerText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: MUTED,
  },
});
