import React from 'react';
import { StyleSheet, Text } from 'react-native';
import ProfileSectionCard from './ProfileSectionCard';

const SUBTLE = '#5B6473';

type Props = {
  text?: string;
  onEdit?: () => void;
};

export default function SummarySection({
  text = '',
  onEdit,
}: Props) {
  return (
    <ProfileSectionCard
      icon={require('../../../assets/icons/summary.png')}
      label="Summary"
      onEdit={onEdit ?? (() => {})}
    >
      <Text style={styles.body}>
        {text.trim() ? text : 'No summary added yet.'}
      </Text>
    </ProfileSectionCard>
  );
}

const styles = StyleSheet.create({
  /** Summary text — Poppins Regular 13 */
  body: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    lineHeight: 19,
    color: SUBTLE,
  },
});
