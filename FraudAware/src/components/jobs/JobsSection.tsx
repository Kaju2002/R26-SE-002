import React from 'react';
import {
  Pressable,
  ScrollView,
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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.hContent}
          decelerationRate="fast"
          snapToInterval={CARD_WIDTH + CARD_GAP}
          snapToAlignment="start"
        >
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              isBookmarked={bookmarkedIds?.has(job.id)}
              onPress={() => onJobPress?.(job.id)}
              onBookmarkPress={() => onBookmarkPress?.(job.id)}
              style={styles.hCard}
            />
          ))}
        </ScrollView>
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
  hContent: {
    paddingHorizontal: 16,
    gap: CARD_GAP,
    paddingRight: 24,
    paddingTop: 4,
    paddingBottom: 12,
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
});
