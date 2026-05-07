import React from 'react';
import ProfileSectionCard from './ProfileSectionCard';
import CVFileItem from './CVFileItem';
import {
  PROFILE_DETAILS,
  type CVFile,
} from '../../../data/profileDetails';

type Props = {
  files?: CVFile[];
  onEdit?: () => void;
  onRemove?: (id: string) => void;
  onPressFile?: (id: string) => void;
};

export default function CVSection({
  files = PROFILE_DETAILS.cvFiles,
  onEdit,
  onRemove,
  onPressFile,
}: Props) {
  return (
    <ProfileSectionCard
      icon={require('../../../assets/icons/cv.png')}
      label="CV / Resume"
      onEdit={onEdit ?? (() => {})}
    >
      {files.map((file) => (
        <CVFileItem
          key={file.id}
          file={file}
          onPress={() => onPressFile?.(file.id)}
          onRemove={() => onRemove?.(file.id)}
        />
      ))}
    </ProfileSectionCard>
  );
}
