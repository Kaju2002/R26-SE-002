import type { LogoFallbackData } from './profile';

export type RecruiterCompany = {
  name: string;
  logoUri?: string;
  website?: string;
  isVerified?: boolean;
  fallback?: LogoFallbackData;
};

export type PublicRecruiterProfile = {
  id: string;
  fullName: string;
  headline: string;
  role: string;
  location: string;
  avatar: string;
  initialsFallback?: LogoFallbackData;
  isVerified: boolean;
  summary: string;
  company: RecruiterCompany;
  allowMessages: boolean;
  isSelf: boolean;
  profileVisibility: string;
};
