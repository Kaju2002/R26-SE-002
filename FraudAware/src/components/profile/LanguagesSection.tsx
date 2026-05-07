import React from 'react';
import ProfileSectionCard from './ProfileSectionCard';
import LanguageItem from './LanguageItem';
import {
  PROFILE_DETAILS,
  type LanguageItem as LanguageItemData,
} from '../../../data/profileDetails';

type Props = {
  items?: LanguageItemData[];
  onAdd?: () => void;
  onItemEdit?: (id: string) => void;
};

export default function LanguagesSection({
  items = PROFILE_DETAILS.languages,
  onAdd,
  onItemEdit,
}: Props) {
  return (
    <ProfileSectionCard
      icon={require('../../../assets/icons/Language.png')}
      label="Language"
      onAdd={onAdd ?? (() => {})}
    >
      {items.map((item, idx) => (
        <LanguageItem
          key={item.id}
          item={item}
          onEdit={() => onItemEdit?.(item.id)}
          showDivider={idx < items.length - 1}
        />
      ))}
    </ProfileSectionCard>
  );
}
