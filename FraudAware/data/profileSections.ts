import type { ImageSourcePropType } from 'react-native';

export type ProfileSectionId =
  | 'summary'
  | 'workExperience'
  | 'education'
  | 'skills'
  | 'languages'
  | 'cv';

export type ProfileSection = {
  id: ProfileSectionId;
  label: string;
  icon: ImageSourcePropType;
};

export const PROFILE_SECTIONS: ProfileSection[] = [
  {
    id: 'summary',
    label: 'Summary',
    icon: require('../assets/icons/summary.png'),
  },
  {
    id: 'workExperience',
    label: 'Work Experience',
    icon: require('../assets/icons/work_experience.png'),
  },
  {
    id: 'education',
    label: 'Education',
    icon: require('../assets/icons/School.png'),
  },
  {
    id: 'skills',
    label: 'Skills',
    icon: require('../assets/icons/skills.png'),
  },
  {
    id: 'languages',
    label: 'Languages',
    icon: require('../assets/icons/Language.png'),
  },
  {
    id: 'cv',
    label: 'CV / Resume',
    icon: require('../assets/icons/cv.png'),
  },
];
