import React from 'react';
import ProfileSectionCard from './ProfileSectionCard';
import EducationItem from './EducationItem';
import type { EducationItem as EducationItemData } from '../../types/profile';

type Props = {
  items?: EducationItemData[];
  onAdd?: () => void;
  onItemEdit?: (id: string) => void;
};

export default function EducationSection({
  items = [],
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
