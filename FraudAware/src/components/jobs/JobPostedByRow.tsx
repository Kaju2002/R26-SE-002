import React from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PublicRecruiterProfile } from '../../types/recruiter';

const NAVY = '#202871';
const MUTED = '#858BBD';

type Props = {
  recruiter: PublicRecruiterProfile;
  onPress: () => void;
};

/** Compact single-row recruiter link — fits inside the job details hero card. */
export default function JobPostedByRow({ recruiter, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`View recruiter profile for ${recruiter.fullName}`}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.88 }]}
    >
      {recruiter.avatar ? (
        <Image source={{ uri: recruiter.avatar }} style={styles.avatar} />
      ) : (
        <View
          style={[
            styles.avatar,
            styles.avatarFallback,
            { backgroundColor: recruiter.initialsFallback?.bg ?? '#EEF0F8' },
          ]}
        >
          <Text
            style={[
              styles.initials,
              { color: recruiter.initialsFallback?.color ?? NAVY },
            ]}
          >
            {recruiter.initialsFallback?.text ?? '?'}
          </Text>
        </View>
      )}

      <Text style={styles.label}>Posted by</Text>
      <Text style={styles.name} numberOfLines={1}>
        {recruiter.fullName}
      </Text>

      <Ionicons name="chevron-forward" size={16} color={NAVY} />
    </Pressable>
  );
}

type HeroRecruiterSlotProps = {
  isOwnJob: boolean;
  recruiterLoading: boolean;
  recruiter: PublicRecruiterProfile | null;
  showRecruiter: boolean;
  onRecruiterPress: () => void;
};

/** Renders the slim recruiter row, own-job note, or loading state inside the hero. */
export function HeroRecruiterSlot({
  isOwnJob,
  recruiterLoading,
  recruiter,
  showRecruiter,
  onRecruiterPress,
}: HeroRecruiterSlotProps) {
  if (isOwnJob) {
    return (
      <View style={styles.ownJobRow}>
        <Text style={styles.ownJobText}>You posted this job</Text>
      </View>
    );
  }

  if (recruiterLoading) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator color={NAVY} size="small" />
      </View>
    );
  }

  if (!showRecruiter || !recruiter) {
    return null;
  }

  return <JobPostedByRow recruiter={recruiter} onPress={onRecruiterPress} />;
}

const AVATAR = 32;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
  },
  label: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: MUTED,
  },
  name: {
    flex: 1,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    color: NAVY,
    minWidth: 0,
  },
  ownJobRow: {
    alignSelf: 'stretch',
    paddingVertical: 6,
  },
  ownJobText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: MUTED,
    textAlign: 'center',
  },
  loadingRow: {
    alignSelf: 'stretch',
    paddingVertical: 8,
    alignItems: 'center',
  },
});
