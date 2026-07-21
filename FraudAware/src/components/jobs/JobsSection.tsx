import React from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import JobCard from './JobCard';
import JobCardSkeletonRow from './JobCardSkeletonRow';
import type { Job } from '../../../data/jobs';

const NAVY = '#202871';
const MUTED = '#858BBD';

type Props = {
  title: string;
  jobs: Job[];
  layout?: 'horizontal' | 'vertical';
  loading?: boolean;
  error?: boolean;
  emptyMessage?: string;
  onRetry?: () => void;
  onJobPress?: (id: string) => void;
  onBookmarkPress?: (id: string) => void;
  onChatPress?: (params: {
    recruiterId: string;
    jobId: string;
    applicationId?: string;
  }) => void;
  currentUserId?: string | null;
  bookmarkedIds?: Set<string>;
  onSeeAllPress?: () => void;
};

const CARD_WIDTH = 320;
const CARD_HEIGHT = 248;
const CARD_GAP = 14;
const H_SCROLL_PADDING_V = 4 + 12;
const HORIZONTAL_SCROLL_HEIGHT = CARD_HEIGHT + H_SCROLL_PADDING_V;

export default function JobsSection({
  title,
  jobs,
  layout = 'horizontal',
  loading = false,
  error = false,
  emptyMessage = 'No jobs to show right now',
  onRetry,
  onJobPress,
  onBookmarkPress,
  onChatPress,
  currentUserId,
  bookmarkedIds,
  onSeeAllPress,
}: Props) {
  const showSeeAll = onSeeAllPress && !loading && !error && jobs.length > 0;

  return (
    <View style={styles.section}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{title}</Text>
        {showSeeAll && (
          <Pressable
            onPress={onSeeAllPress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`See all ${title}`}
            style={({ pressed }) => [
              styles.seeAllBtn,
              pressed && { opacity: 0.6 },
            ]}
          >
            <Text style={styles.seeAllText}>See all</Text>
            <Ionicons name="chevron-forward" size={14} color={NAVY} />
          </Pressable>
        )}
      </View>

      {loading ? (
        <JobCardSkeletonRow
          layout={layout}
          count={layout === 'horizontal' ? 2 : 3}
        />
      ) : error ? (
        <View style={styles.stateBox}>
          <Text style={styles.stateText}>Couldn’t load jobs</Text>
          <Text style={styles.stateHint}>Check your connection and try again</Text>
          {onRetry && (
            <Pressable
              onPress={onRetry}
              accessibilityRole="button"
              accessibilityLabel="Retry loading jobs"
              style={({ pressed }) => [
                styles.retryBtn,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          )}
        </View>
      ) : jobs.length === 0 ? (
        <View style={styles.stateBox}>
          <Text style={styles.stateText}>{emptyMessage}</Text>
        </View>
      ) : layout === 'horizontal' ? (
        <View style={styles.hScrollClip}>
          <FlatList
            data={jobs}
            horizontal
            keyExtractor={(job) => job.id}
            renderItem={({ item: job, index }) => (
              <JobCard
                job={job}
                isBookmarked={bookmarkedIds?.has(job.id)}
                onPress={() => onJobPress?.(job.id)}
                onBookmarkPress={() => onBookmarkPress?.(job.id)}
                onChatPress={onChatPress}
                currentUserId={currentUserId}
                style={[
                  styles.hCard,
                  index < jobs.length - 1 ? styles.hCardSpacing : null,
                ]}
              />
            )}
            style={styles.hScroll}
            contentContainerStyle={styles.hContent}
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={CARD_WIDTH + CARD_GAP}
            snapToAlignment="start"
            nestedScrollEnabled
            removeClippedSubviews={false}
          />
        </View>
      ) : (
        <View style={styles.vList}>
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              isBookmarked={bookmarkedIds?.has(job.id)}
              onPress={() => onJobPress?.(job.id)}
              onBookmarkPress={() => onBookmarkPress?.(job.id)}
              onChatPress={onChatPress}
              currentUserId={currentUserId}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 18,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  title: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    color: NAVY,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingLeft: 8,
  },
  seeAllText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: NAVY,
  },
  hScrollClip: {
    height: HORIZONTAL_SCROLL_HEIGHT,
    overflow: 'hidden',
  },
  hScroll: {
    flexGrow: 0,
    flexShrink: 0,
    height: HORIZONTAL_SCROLL_HEIGHT,
  },
  hContent: {
    paddingHorizontal: 16,
    paddingRight: 24,
    paddingTop: 4,
    paddingBottom: 12,
  },
  hCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  },
  hCardSpacing: {
    marginRight: CARD_GAP,
  },
  vList: {
    paddingHorizontal: 16,
    gap: 14,
    paddingBottom: 4,
  },
  stateBox: {
    marginHorizontal: 16,
    paddingVertical: 28,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F7F8FE',
    alignItems: 'center',
  },
  stateText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: NAVY,
    textAlign: 'center',
  },
  stateHint: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: MUTED,
    textAlign: 'center',
    marginTop: 4,
  },
  retryBtn: {
    marginTop: 14,
    backgroundColor: NAVY,
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: '#FFFFFF',
  },
});
