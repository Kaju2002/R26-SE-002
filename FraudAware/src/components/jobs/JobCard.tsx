import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LogoFallback from '../profile/LogoFallback';
import JobTagChip, { type ChipTone } from './JobTagChip';
import {
  formatPostedAt,
  formatSalaryRange,
  type Job,
  type JobMode,
  type JobType,
} from '../../../data/jobs';
import type { ApplicationStatus } from '../../../data/applicationNotifications';

const NAVY = '#202871';
const MUTED = '#858BBD';
const BORDER = '#D6DAEA';
const CARD_BG = '#FFFFFF';
const VERIFIED = '#2E7DEB';

const TYPE_TONE: Record<JobType, ChipTone> = {
  'Full-Time': 'navy',
  'Part-Time': 'amber',
  Contract: 'amber',
  Internship: 'green',
};

const MODE_TONE: Record<JobMode, ChipTone> = {
  'On-Site': 'neutral',
  Hybrid: 'green',
  Remote: 'green',
};

const STATUS_META: Record<
  ApplicationStatus,
  { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string; label: string }
> = {
  sent: {
    icon: 'paper-plane',
    color: '#42498A',
    bg: '#E8EBFA',
    label: 'Applied',
  },
  pending: {
    icon: 'time-outline',
    color: '#C47F08',
    bg: '#FFF5E6',
    label: 'Pending',
  },
  accepted: {
    icon: 'checkmark-circle',
    color: '#1B7A3D',
    bg: '#E8F6EE',
    label: 'Accepted',
  },
  rejected: {
    icon: 'close-circle',
    color: '#C62828',
    bg: '#FDEDEE',
    label: 'Rejected',
  },
};

type Props = {
  job: Job;
  onPress?: () => void;
  onBookmarkPress?: () => void;
  isBookmarked?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function JobCard({
  job,
  onPress,
  onBookmarkPress,
  isBookmarked,
  style,
}: Props) {
  const status = job.applicationStatus
    ? STATUS_META[job.applicationStatus]
    : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${job.title} at ${job.companyName}`}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
        style,
      ]}
    >
      <View style={styles.top}>
        <LogoFallback
          source={job.companyLogo}
          fallback={job.companyFallback}
          size={56}
          borderRadius={12}
        />

        <View style={styles.titleCol}>
          <Text style={styles.title} numberOfLines={2}>
            {job.title}
          </Text>
          <View style={styles.companyRow}>
            <Text style={styles.company} numberOfLines={1}>
              {job.companyName}
            </Text>
            {job.isVerified && (
              <Ionicons
                name="checkmark-circle"
                size={14}
                color={VERIFIED}
                style={styles.verifiedIcon}
              />
            )}
          </View>
        </View>

        {status ? (
          <View
            accessibilityRole="text"
            accessibilityLabel={`Application ${status.label}`}
            style={[styles.statusPill, { backgroundColor: status.bg }]}
          >
            <Ionicons name={status.icon} size={14} color={status.color} />
          </View>
        ) : (
          <Pressable
            onPress={onBookmarkPress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={
              isBookmarked ? 'Remove bookmark' : 'Bookmark job'
            }
            style={({ pressed }) => [
              styles.bookmarkBtn,
              pressed && { opacity: 0.6 },
            ]}
          >
            <Image
              source={require('../../../assets/icons/Vector (1).png')}
              style={[
                styles.bookmarkIcon,
                isBookmarked && { tintColor: VERIFIED },
              ]}
              resizeMode="contain"
            />
          </Pressable>
        )}
      </View>

      <View style={styles.divider} />

      <View style={styles.bottom}>
        <Text style={styles.metaLine} numberOfLines={1}>
          <Ionicons name="location-outline" size={13} color={MUTED} />
          <Text style={styles.metaText}> {job.location}</Text>
          <Text style={styles.metaDot}>  ·  </Text>
          <Text style={styles.metaText}>{formatPostedAt(job.postedAt)}</Text>
        </Text>

        <Text style={styles.salaryLine} numberOfLines={1}>
          <Text style={styles.salaryRange}>{formatSalaryRange(job)}</Text>
          {job.salaryPeriod ? (
            <Text style={styles.salaryPeriod}> {job.salaryPeriod}</Text>
          ) : null}
        </Text>

        <View style={styles.tagsRow}>
          <View style={styles.tags}>
            <JobTagChip label={job.type} tone={TYPE_TONE[job.type]} />
            <JobTagChip label={job.mode} tone={MODE_TONE[job.mode]} />
          </View>
          {typeof job.matchScore === 'number' && (
            <View style={styles.matchChip}>
              <Ionicons name="sparkles" size={12} color={NAVY} />
              <Text style={styles.matchText}>{job.matchScore}% match</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 18,
    paddingHorizontal: 18,
    shadowColor: '#1F2A6E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  cardPressed: {
    opacity: 0.97,
    transform: [{ scale: 0.997 }],
  },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  titleCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
    paddingTop: 2,
  },
  /** Job title — Poppins SemiBold 17 · #202871 */
  title: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 17,
    color: NAVY,
    lineHeight: 24,
  },
  companyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  /** Company — Poppins Regular 14 · #858BBD */
  company: {
    flexShrink: 1,
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: MUTED,
    lineHeight: 20,
  },
  verifiedIcon: {
    marginTop: 1,
  },
  bookmarkBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -2,
  },
  bookmarkIcon: {
    width: 24,
    height: 24,
    tintColor: NAVY,
  },
  statusPill: {
    minWidth: 36,
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -2,
  },
  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginVertical: 14,
  },
  bottom: {
    gap: 8,
  },
  metaLine: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: MUTED,
    lineHeight: 18,
  },
  metaText: {
    color: MUTED,
  },
  metaDot: {
    color: MUTED,
  },
  salaryLine: {
    lineHeight: 26,
  },
  /** Salary — Poppins SemiBold 18 · #202871 */
  salaryRange: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    color: NAVY,
  },
  salaryPeriod: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: MUTED,
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  tags: {
    flexDirection: 'row',
    gap: 8,
  },
  matchChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#EEF0F8',
  },
  matchText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 11,
    color: NAVY,
  },
});
