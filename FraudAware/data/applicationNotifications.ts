import type { ImageSourcePropType } from 'react-native';

export type ApplicationStatus = 'sent' | 'pending' | 'accepted' | 'rejected';

export type ApplicationListItem = {
  id: string;
  jobTitle: string;
  companyName: string;
  status: ApplicationStatus;
  logo?: ImageSourcePropType;
  fallback?: { text: string; bg: string; color?: string };
};

export const APPLICATION_NOTIFICATIONS: ApplicationListItem[] = [
  {
    id: 'apl-1',
    jobTitle: 'Chartered Accountant',
    companyName: 'Ecobank Ghana PLC',
    status: 'sent',
    logo: require('../assets/icons/ecobank_transnational_icon.jpeg.png'),
  },
  {
    id: 'apl-2',
    jobTitle: 'Loan Officer',
    companyName: 'GTBank Ghana',
    status: 'pending',
    logo: require('../assets/icons/gtbank_icon.jpeg.png'),
  },
  {
    id: 'apl-3',
    jobTitle: 'Loans Officer',
    companyName: 'Calbank PLC',
    status: 'accepted',
    fallback: { text: 'CB', bg: '#FBE0B6', color: '#7A5418' },
  },
  {
    id: 'apl-4',
    jobTitle: 'Internal Auditor',
    companyName: 'Consolidated Bank Ghana',
    status: 'rejected',
    fallback: { text: 'C', bg: '#1F2A6E', color: '#FFFFFF' },
  },
  {
    id: 'apl-5',
    jobTitle: 'Chartered Accountant',
    companyName: 'Ecobank Ghana PLC',
    status: 'pending',
    logo: require('../assets/icons/ecobank_transnational_icon.jpeg.png'),
  },
];
