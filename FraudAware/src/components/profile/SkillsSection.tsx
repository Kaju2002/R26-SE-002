import React from 'react';
import { StyleSheet, View } from 'react-native';
import ProfileSectionCard from './ProfileSectionCard';
import SkillPill from './SkillPill';
import { PROFILE_DETAILS } from '../../../data/profileDetails';

type Props = {
  skills?: string[];
  onAdd?: () => void;
};

export default function SkillsSection({
  skills = PROFILE_DETAILS.skills,
  onAdd,
}: Props) {
  return (
    <ProfileSectionCard
      icon={require('../../../assets/icons/skills.png')}
      label="Skills"
      onAdd={onAdd ?? (() => {})}
    >
      <View style={styles.wrap}>
        {skills.map((s) => (
          <SkillPill key={s} label={s} />
        ))}
      </View>
    </ProfileSectionCard>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
