import type { ImageSourcePropType } from 'react-native';
import type { LogoFallbackData } from '../src/types/profile';

export type ApplicationStatus = 'sent' | 'pending' | 'accepted' | 'rejected';

export type ApplicationListItem = {
  id: string;
  jobTitle: string;
  companyName: string;
  status: ApplicationStatus;
  logo?: ImageSourcePropType;
  fallback?: LogoFallbackData;
};
