export type LogoFallbackData = {
  text: string;
  bg: string;
  color?: string;
};

export type ProfileStat = {
  id: string;
  label: string;
  value: number;
};

export type ProfileMenuItem = {
  id: string;
  label: string;
};

export type ProfileCompany = {
  name: string;
  logo?: string;
  logoUri?: string;
  website?: string;
  isVerified?: boolean;
  fallback?: LogoFallbackData;
};

export type UserProfile = {
  id: string;
  email: string;
  fullName: string;
  shortName: string;
  role: string;
  headline: string;
  location: string;
  avatar: string;
  phone: string;
  dateOfBirth: string | null;
  isVerified: boolean;
  company: ProfileCompany;
  stats: ProfileStat[];
  isPremium: boolean;
  premiumLabel: string;
};

export type WorkExperience = {
  id: string;
  role: string;
  company: string;
  duration: string;
  logoUri?: string;
  fallback?: LogoFallbackData;
  startDate?: string;
  endDate?: string | null;
  isCurrentlyWorking?: boolean;
  description?: string;
  location?: string;
};

export type EducationItem = {
  id: string;
  degree: string;
  institution: string;
  duration: string;
  fieldOfStudy?: string;
  logoUri?: string;
  fallback?: LogoFallbackData;
  startDate?: string;
  endDate?: string | null;
  description?: string;
};

export type LanguageItem = {
  id: string;
  name: string;
  proficiency: string;
  flagUri?: string;
};

export type CVFile = {
  id: string;
  name: string;
  size: string;
  fileUrl?: string;
  fileSize?: number;
  isPrimary?: boolean;
  uploadedAt?: string;
};

export type ProfileDetailsData = {
  summary: string;
  experiences: WorkExperience[];
  education: EducationItem[];
  skills: string[];
  languages: LanguageItem[];
  cvFiles: CVFile[];
};

export type ProfileResponse = {
  success: boolean;
  message: string;
  profile: UserProfile;
  details: ProfileDetailsData;
};

export type UpdateBasicProfileRequest = {
  fullName?: string;
  phone?: string;
  headline?: string;
  currentPosition?: string;
  role?: string;
  location?: string;
  dob?: string;
  dateOfBirth?: string;
  company?: string | ProfileCompany;
};

export type WorkExperienceRequest = {
  role: string;
  company: string;
  startDate: string;
  endDate?: string | null;
  isCurrentlyWorking?: boolean;
  description?: string;
  location?: string;
};

export type EducationRequest = {
  degree: string;
  institution: string;
  fieldOfStudy?: string;
  startDate: string;
  endDate?: string | null;
  description?: string;
};

export type LanguageRequest = {
  name: string;
  proficiency: string;
};

export const LANGUAGE_PROFICIENCY_OPTIONS = [
  'Elementary Proficiency',
  'Limited Working Proficiency',
  'Professional Working Proficiency',
  'Full Professional Proficiency',
  'Native or Bilingual Proficiency',
] as const;

export const DEFAULT_LANGUAGE_PROFICIENCY = LANGUAGE_PROFICIENCY_OPTIONS[2];

const LEGACY_PROFICIENCY_MAP: Record<string, string> = {
  Native: 'Native or Bilingual Proficiency',
  Fluent: 'Full Professional Proficiency',
  Professional: 'Professional Working Proficiency',
  Intermediate: 'Limited Working Proficiency',
  Basic: 'Elementary Proficiency',
};

export function normalizeLanguageProficiency(value: string): string {
  if ((LANGUAGE_PROFICIENCY_OPTIONS as readonly string[]).includes(value)) {
    return value;
  }
  return LEGACY_PROFICIENCY_MAP[value] ?? value;
}

export const DRAWER_MENU_ITEMS: ProfileMenuItem[] = [
  { id: 'puzzle', label: 'Puzzle games' },
  { id: 'saved', label: 'Saved posts' },
  { id: 'groups', label: 'Groups' },
];
