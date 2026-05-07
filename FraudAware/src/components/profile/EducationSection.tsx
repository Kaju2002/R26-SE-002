import React from 'react';
import ProfileSectionCard from './ProfileSectionCard';
import EducationItem from './EducationItem';
import {
  PROFILE_DETAILS,
  type EducationItem as EducationItemData,
} from '../../../data/profileDetails';

type Props = {
  items?: EducationItemData[];
  onAdd?: () => void;
  onItemEdit?: (id: string) => void;
};

export default function EducationSection({
  items = PROFILE_DETAILS.education,
  onAdd,
  onItemEdit,
}: Props) {
  return (
    <ProfileSectionCard
      icon={require('../../../assets/icons/School.png')}
      label="Education"
      onAdd={onAdd ?? (() => {})}
    >
      {items.map((item, idx) => (
        <EducationItem
          key={item.id}
          item={item}
          onEdit={() => onItemEdit?.(item.id)}
          showDivider={idx < items.length - 1}
        />
      ))}
    </ProfileSectionCard>
  );
}
