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
import type { Job } from '../../../data/jobs';

const NAVY = '#202871';
const MUTED = '#858BBD';

type Props = {
  title: string;
  jobs: Job[];
  layout?: 'horizontal' | 'vertical';
  onJobPress?: (id: string) => void;
  onBookmarkPress?: (id: string) => void;
  bookmarkedIds?: Set<string>;
  onSeeAllPress?: () => void;
};

const CARD_WIDTH = 320;
const CARD_HEIGHT = 248;
const CARD_GAP = 14;
/** Vertical padding inside horizontal row (hContent) — keep in sync with styles.hContent */
const H_SCROLL_PADDING_V = 4 + 12;
/** Nested horizontal list must have bounded height or it expands inside parent scroll */
const HORIZONTAL_SCROLL_HEIGHT = CARD_HEIGHT + H_SCROLL_PADDING_V;

export default function JobsSection({
  title,
  jobs,
  layout = 'horizontal',
  onJobPress,
  onBookmarkPress,
  bookmarkedIds,
  onSeeAllPress,
}: Props) {
  return (
    <View style={styles.section}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{title}</Text>
        {onSeeAllPress && (
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

      {layout === 'horizontal' ? (
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
  /** Section title — Poppins Medium 16 · #202871 */
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
  /** Clip so FlatList cannot expand vertically inside parent scroll */
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
});
