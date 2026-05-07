import React from 'react';
import { View } from 'react-native';
import {
  PROFILE_SECTIONS,
  type ProfileSection,
  type ProfileSectionId,
} from '../../../data/profileSections';
import ProfileSectionRow from './ProfileSectionRow';

type Props = {
  sections?: ProfileSection[];
  onSectionPress?: (id: ProfileSectionId) => void;
  onSectionAdd?: (id: ProfileSectionId) => void;
};

export default function ProfileSectionList({
  sections = PROFILE_SECTIONS,
  onSectionPress,
  onSectionAdd,
}: Props) {
  return (
    <View>
      {sections.map((s) => (
        <ProfileSectionRow
          key={s.id}
          label={s.label}
          icon={s.icon}
          onPress={() => onSectionPress?.(s.id)}
          onAddPress={() => onSectionAdd?.(s.id)}
        />
      ))}
    </View>
  );
}
