import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ProfileSectionCard from './ProfileSectionCard';
import SkillPill from './SkillPill';

type Props = {
  skills?: string[];
  onAdd?: () => void;
};

export default function SkillsSection({
  skills = [],
  onAdd,
}: Props) {
  return (
    <ProfileSectionCard
      icon={require('../../../assets/icons/skills.png')}
      label="Skills"
      onAdd={onAdd ?? (() => {})}
    >
      <View style={styles.wrap}>
        {skills.length > 0 ? (
          skills.map((s) => <SkillPill key={s} label={s} />)
        ) : (
          <Text style={styles.empty}>No skills added yet.</Text>
        )}
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
  empty: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: '#5B6473',
  },
});
