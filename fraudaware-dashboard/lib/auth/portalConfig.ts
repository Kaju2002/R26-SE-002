import type { AccountType } from '@/lib/api/authTypes';

export type PortalType = 'admin' | 'recruiter';

export type PortalConfig = {
  portalLabel: string;
  title: string;
  subtitle: string;
  emailPlaceholder: string;
  footerNote: string;
  illustration: string;
  illustrationAlt: string;
  leftDescription: string;
  requiredAccountType: AccountType;
  loginPath: string;
  dashboardPath: string;
};

export const portalConfigs: Record<PortalType, PortalConfig> = {
  admin: {
    portalLabel: 'Super Admin Portal',
    title: 'Super Admin Login',
    subtitle: 'Sign in to manage the FraudAware platform',
    emailPlaceholder: 'admin@fraudaware.com',
    footerNote: 'Authorized super admin access only',
    illustration: '/images/admin-login-illustration.svg',
    illustrationAlt: 'FraudAware admin portal',
    leftDescription:
      'Monitor platform activity, manage users, and keep FraudAware secure for job seekers and recruiters.',
    requiredAccountType: 'superadmin',
    loginPath: '/admin/login',
    dashboardPath: '/admin/dashboard',
  },
  recruiter: {
    portalLabel: 'Recruiter Portal',
    title: 'Recruiter Login',
    subtitle: 'Sign in to manage jobs and chat with applicants',
    emailPlaceholder: 'recruiter@company.com',
    footerNote: 'Authorized recruiter access only',
    illustration: '/images/recruiter-login-illustration.svg',
    illustrationAlt: 'FraudAware recruiter portal',
    leftDescription:
      'Post jobs, review applications, and connect with candidates through FraudAware.',
    requiredAccountType: 'recruiter',
    loginPath: '/recruiter/login',
    dashboardPath: '/recruiter/dashboard',
  },
};
