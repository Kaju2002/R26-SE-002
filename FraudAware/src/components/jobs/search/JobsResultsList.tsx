import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import JobCard from '../JobCard';
import type { Job } from '../../../../data/jobs';
import { JOB_SEARCH_COLORS } from './jobSearchTheme';

type Props = {
  jobs: Job[];
  onJobPress: (id: string) => void;
  bookmarkedIds: Set<string>;
  onBookmarkPress: (id: string) => void;
  onSortPress: (anchor: { x: number; y: number }) => void;
};

export default function JobsResultsList({
  jobs,
  onJobPress,
  bookmarkedIds,
  onBookmarkPress,
  onSortPress,
}: Props) {
  return (
    <>
      <View style={styles.topRow}>
        <Text style={styles.countText}>{jobs.length} Found</Text>
        <Pressable
          onPress={(event) =>
            onSortPress({
              x: event.nativeEvent.pageX,
              y: event.nativeEvent.pageY,
            })
          }
          style={({ pressed }) => [styles.sortBtn, pressed && { opacity: 0.6 }]}
        >
          <Image
            source={require('../../../../assets/icons/Sort.png')}
            style={styles.sortIcon}
            resizeMode="contain"
          />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {jobs.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            onPress={() => onJobPress(job.id)}
            isBookmarked={bookmarkedIds.has(job.id)}
            onBookmarkPress={() => onBookmarkPress(job.id)}
          />
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 4,
  },
  countText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: JOB_SEARCH_COLORS.secondaryText,
  },
  sortBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortIcon: {
    width: 24,
    height: 24,
    tintColor: JOB_SEARCH_COLORS.primaryText,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
    gap: 12,
  },
});
