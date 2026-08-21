import type { ImageSourcePropType } from 'react-native';
import type { LogoFallbackData } from '../src/types/profile';

/** Job application pipeline status (aligned with job-management). */
export type ApplicationStatus =
  | 'applied'
  | 'screened'
  | 'shortlisted'
  | 'interview'
  | 'offered'
  | 'hired'
  | 'rejected'
  // Legacy values still returned by older records
  | 'sent'
  | 'pending'
  | 'accepted';

export type ApplicationListItem = {
  id: string;
  jobTitle: string;
  companyName: string;
  status: ApplicationStatus;
  logo?: ImageSourcePropType;
  fallback?: LogoFallbackData;
};
