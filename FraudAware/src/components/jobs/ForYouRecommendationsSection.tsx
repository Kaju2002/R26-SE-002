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
import type { RankedJob } from '../../hooks/useSafeJobRecommendations';

const NAVY = '#202871';
const MUTED = '#858BBD';

type Props = {
  title?: string;
  jobs: RankedJob[];
  skills: string[];
  loading?: boolean;
  status: 'idle' | 'loading' | 'success' | 'error' | 'needs_skills';
  errorMessage?: string | null;
  layout?: 'horizontal' | 'vertical';
  onRetry?: () => void;
  onSeeAllPress?: () => void;
  onAddSkillsPress?: () => void;
  onJobPress?: (jobId: string) => void;
  onBookmarkPress?: (jobId: string) => void;
  onChatPress?: (params: {
    recruiterId: string;
    jobId: string;
    applicationId?: string;
  }) => void;
  currentUserId?: string | null;
  bookmarkedIds?: Set<string>;
};

const CARD_WIDTH = 320;
const CARD_HEIGHT = 248;
const CARD_GAP = 14;
const H_SCROLL_PADDING_V = 4 + 12;
const HORIZONTAL_SCROLL_HEIGHT = CARD_HEIGHT + H_SCROLL_PADDING_V + 28;

export default function ForYouRecommendationsSection({
  title = 'For you',
  jobs,
  skills,
  loading = false,
  status,
  errorMessage,
  layout = 'horizontal',
  onRetry,
  onSeeAllPress,
  onAddSkillsPress,
  onJobPress,
  onBookmarkPress,
  onChatPress,
  currentUserId,
  bookmarkedIds,
}: Props) {
  const showSeeAll =
    Boolean(onSeeAllPress) && !loading && status === 'success' && jobs.length > 0;

  return (
    <View style={styles.section}>
      <View style={styles.titleRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{title}</Text>
          {skills.length > 0 && status === 'success' ? (
            <Text style={styles.skillsHint} numberOfLines={1}>
              Ranked for your skills
            </Text>
          ) : null}
        </View>
        {showSeeAll ? (
          <Pressable
            onPress={onSeeAllPress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`See all ${title}`}
            style={({ pressed }) => [styles.seeAllBtn, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.seeAllText}>See all</Text>
            <Ionicons name="chevron-forward" size={14} color={NAVY} />
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <JobCardSkeletonRow
          layout={layout}
          count={layout === 'horizontal' ? 2 : 3}
        />
      ) : status === 'needs_skills' ? (
        <View style={styles.stateBox}>
          <Text style={styles.stateText}>Add skills to personalize For you</Text>
          <Text style={styles.stateHint}>
            Recommendations use the skills on your profile.
          </Text>
          {onAddSkillsPress ? (
            <Pressable
              onPress={onAddSkillsPress}
              style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.actionBtnText}>Go to Profile</Text>
            </Pressable>
          ) : null}
        </View>
      ) : status === 'error' ? (
        <View style={styles.stateBox}>
          <Text style={styles.stateText}>Couldn’t load recommendations</Text>
          <Text style={styles.stateHint}>
            {errorMessage ?? 'Check the recommendation service and try again.'}
          </Text>
          {onRetry ? (
            <Pressable
              onPress={onRetry}
              style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.actionBtnText}>Retry</Text>
            </Pressable>
          ) : null}
        </View>
      ) : jobs.length === 0 ? (
        <View style={styles.stateBox}>
          <Text style={styles.stateText}>No matches yet</Text>
          <Text style={styles.stateHint}>Try adding more skills on your profile.</Text>
        </View>
      ) : layout === 'horizontal' ? (
        <View style={styles.hScrollClip}>
          <FlatList
            data={jobs}
            horizontal
            keyExtractor={(job) => job.id}
            renderItem={({ item: job, index }) => (
              <View
                style={[
                  styles.hCardWrap,
                  index < jobs.length - 1 ? styles.hCardSpacing : null,
                ]}
              >
                <RankBadge rank={job.rank} />
                <JobCard
                  job={job}
                  isBookmarked={bookmarkedIds?.has(job.id)}
                  onPress={() => onJobPress?.(job.id)}
                  onBookmarkPress={() => onBookmarkPress?.(job.id)}
                  onChatPress={onChatPress}
                  currentUserId={currentUserId}
                  style={styles.hCard}
                />
              </View>
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
            <View key={job.id} style={styles.vCardWrap}>
              <RankBadge rank={job.rank} />
              <JobCard
                job={job}
                isBookmarked={bookmarkedIds?.has(job.id)}
                onPress={() => onJobPress?.(job.id)}
                onBookmarkPress={() => onBookmarkPress?.(job.id)}
                onChatPress={onChatPress}
                currentUserId={currentUserId}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function RankBadge({ rank }: { rank: number }) {
  return (
    <View style={styles.rankBadge}>
      <Text style={styles.rankText}>#{rank}</Text>
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
  titleBlock: {
    flex: 1,
    paddingRight: 8,
  },
  title: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    color: NAVY,
  },
  skillsHint: {
    marginTop: 2,
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    color: MUTED,
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
  stateBox: {
    marginHorizontal: 16,
    paddingVertical: 24,
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
    marginTop: 6,
  },
  actionBtn: {
    marginTop: 14,
    backgroundColor: NAVY,
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  actionBtnText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: '#FFFFFF',
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
  hCardWrap: {
    width: CARD_WIDTH,
  },
  hCardSpacing: {
    marginRight: CARD_GAP,
  },
  hCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  },
  vList: {
    paddingHorizontal: 16,
    gap: 14,
    paddingBottom: 4,
  },
  vCardWrap: {
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
});
