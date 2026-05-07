import React from 'react';
import { StyleSheet, Text } from 'react-native';
import ProfileSectionCard from './ProfileSectionCard';
import { PROFILE_DETAILS } from '../../../data/profileDetails';

const SUBTLE = '#5B6473';

type Props = {
  text?: string;
  onEdit?: () => void;
};

export default function SummarySection({
  text = PROFILE_DETAILS.summary,
  onEdit,
}: Props) {
  return (
    <ProfileSectionCard
      icon={require('../../../assets/icons/summary.png')}
      label="Summary"
      onEdit={onEdit ?? (() => {})}
    >
      <Text style={styles.body}>{text}</Text>
    </ProfileSectionCard>
  );
}

const styles = StyleSheet.create({
  /** Summary text — Poppins Regular 12 */
  body: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    lineHeight: 18,
    color: SUBTLE,
  },
});
