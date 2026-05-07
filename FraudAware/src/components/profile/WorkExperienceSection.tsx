import React from 'react';
import ProfileSectionCard from './ProfileSectionCard';
import WorkExperienceItem from './WorkExperienceItem';
import {
  PROFILE_DETAILS,
  type WorkExperience,
} from '../../../data/profileDetails';

type Props = {
  items?: WorkExperience[];
  onAdd?: () => void;
  onItemEdit?: (id: string) => void;
};

export default function WorkExperienceSection({
  items = PROFILE_DETAILS.experiences,
  onAdd,
  onItemEdit,
}: Props) {
  return (
    <ProfileSectionCard
      icon={require('../../../assets/icons/work_experience.png')}
      label="Work Experience"
      onAdd={onAdd ?? (() => {})}
    >
      {items.map((item, idx) => (
        <WorkExperienceItem
          key={item.id}
          item={item}
          onEdit={() => onItemEdit?.(item.id)}
          showDivider={idx < items.length - 1}
        />
      ))}
    </ProfileSectionCard>
  );
}
