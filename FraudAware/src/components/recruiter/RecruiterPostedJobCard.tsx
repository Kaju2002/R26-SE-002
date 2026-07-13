import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LogoFallback from '../profile/LogoFallback';
import { formatSalaryRange, type Job } from '../../../data/jobs';

const NAVY = '#202871';
const MUTED = '#858BBD';
const BORDER = '#D6DAEA';
const HIGHLIGHT = '#EEF0F8';

type Props = {
  job: Job;
  highlighted?: boolean;
  onPress: () => void;
};

export default function RecruiterPostedJobCard({
  job,
  highlighted,
  onPress,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${job.title} at ${job.companyName}`}
      style={({ pressed }) => [
        styles.card,
        highlighted && styles.cardHighlighted,
        pressed && { opacity: 0.92 },
      ]}
    >
      {highlighted ? (
        <View style={styles.badgeRow}>
          <Ionicons name="briefcase-outline" size={14} color={NAVY} />
          <Text style={styles.badgeText}>Related to this job</Text>
        </View>
      ) : null}

      <Text style={styles.title} numberOfLines={2}>
        {job.title}
      </Text>
      <View style={styles.companyRow}>
        <LogoFallback
          source={job.companyLogo}
          fallback={job.companyFallback}
          size={28}
          borderRadius={8}
        />
        <Text style={styles.company} numberOfLines={1}>
          {job.companyName}
        </Text>
      </View>
      <Text style={styles.meta} numberOfLines={1}>
        {formatSalaryRange(job)}
        {job.salaryPeriod ? ` ${job.salaryPeriod}` : ''}
        {'  ·  '}
        {job.location}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  cardHighlighted: {
    backgroundColor: HIGHLIGHT,
    borderColor: NAVY,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: NAVY,
  },
  title: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
    color: NAVY,
    lineHeight: 22,
  },
  companyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  company: {
    flex: 1,
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: MUTED,
  },
  meta: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: MUTED,
  },
});
