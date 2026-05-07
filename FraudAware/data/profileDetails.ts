import type { ImageSourcePropType } from 'react-native';

export type LogoFallbackData = {
  text: string;
  bg: string;
  color?: string;
};

export type WorkExperience = {
  id: string;
  role: string;
  company: string;
  duration: string;
  logo?: ImageSourcePropType;
  logoUri?: string;
  fallback?: LogoFallbackData;
};

export type EducationItem = {
  id: string;
  degree: string;
  institution: string;
  duration: string;
  logo?: ImageSourcePropType;
  logoUri?: string;
  fallback?: LogoFallbackData;
};

export type LanguageItem = {
  id: string;
  name: string;
  proficiency: string;
  flag?: ImageSourcePropType;
  flagUri?: string;
};

export type CVFile = {
  id: string;
  name: string;
  size: string;
};

export type ProfileDetails = {
  summary: string;
  experiences: WorkExperience[];
  education: EducationItem[];
  skills: string[];
  languages: LanguageItem[];
  cvFiles: CVFile[];
};

export const PROFILE_DETAILS: ProfileDetails = {
  summary:
    'Arx thema aptus aliquid rerum apostolus claro tabesco complectus alveus. Depopulo dolores adipiscor illo placeat textus cotidie paulatim. Video cupiditate vulgivagus arcesso torrens vomer culpa.',
  experiences: [
    {
      id: 'gtbank',
      role: 'Loan Officer',
      company: 'GTBank Ghana',
      duration: 'Nov 2023 - Present | Less than a year',
      logo: require('../assets/icons/gtbank_icon.jpeg.png'),
    },
    {
      id: 'carbank',
      role: 'Loan Officer',
      company: 'Carbank PLC',
      duration: 'Sept 2022 - Nov 2023 | 1 year',
      fallback: { text: 'CB', bg: '#FBE0B6', color: '#7A5418' },
    },
    {
      id: 'eobank',
      role: 'Chartered Accountant',
      company: 'Eobank Ghana PLC',
      duration: 'Jan 2021 - Sept 2022 | 2 years',
      fallback: { text: 'E', bg: '#1F2A6E', color: '#FFFFFF' },
    },
  ],
  education: [
    {
      id: 'uog',
      degree: 'Master of Accounting',
      institution: 'University of Ghana',
      duration: '2014 - 2016 | 2 Years',
      logo: require('../assets/icons/Frame 224.png'),
    },
    {
      id: 'knust',
      degree: 'BSc Accounting',
      institution: 'Kwame Nkrumah University of Science and Technology',
      duration: '2010 - 2013 | 4 Years',
      fallback: { text: 'KN', bg: '#FFE091', color: '#5C3F00' },
    },
  ],
  skills: [
    'Financial Analysis',
    'Investment Research',
    'Analytical Thinking',
    'Data Analysis',
    'Risk Management',
    'Excel Proficiency',
    'Communication Skills',
  ],
  languages: [
    {
      id: 'en',
      name: 'English (UK)',
      proficiency: 'Professional Working Proficiency',
      flag: require('../assets/icons/uk.png'),
    },
    {
      id: 'fr',
      name: 'French',
      proficiency: 'Professional Working Proficiency',
      flagUri: 'https://flagcdn.com/w80/fr.png',
    },
    {
      id: 'tw',
      name: 'Twi',
      proficiency: 'Native or Bilingual Proficiency',
      flagUri: 'https://flagcdn.com/w80/gh.png',
    },
  ],
  cvFiles: [
    { id: 'cv-1', name: 'Resume_Kajanthan.pdf', size: '543 kb' },
  ],
};
