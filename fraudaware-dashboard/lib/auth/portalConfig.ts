import type { AccountType } from '@/lib/api/authTypes';

export type PortalType = 'admin' | 'recruiter' | 'company';

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
  registerPath: string;
  dashboardPath: string;
  basePath: string;
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
    registerPath: '/admin/login',
    dashboardPath: '/admin/dashboard',
    basePath: '/admin',
  },
  recruiter: {
    portalLabel: 'Recruiter Portal',
    title: 'Recruiter Login',
    subtitle: 'Sign in to manage jobs and chat with applicants',
    emailPlaceholder: 'recruiter@agency.com',
    footerNote: 'Authorized recruiter access only',
    illustration: '/images/recruiter-login-illustration.svg',
    illustrationAlt: 'FraudAware recruiter portal',
    leftDescription:
      'Post jobs for any employer, review applications, email candidates, and connect through FraudAware.',
    requiredAccountType: 'recruiter',
    loginPath: '/recruiter/login',
    registerPath: '/recruiter/register',
    dashboardPath: '/recruiter/dashboard',
    basePath: '/recruiter',
  },
  company: {
    portalLabel: 'Company Portal',
    title: 'Company Login',
    subtitle: 'Sign in to post company jobs and review applicants',
    emailPlaceholder: 'hiring@yourcompany.com',
    footerNote: 'Authorized company access only',
    illustration: '/images/recruiter-login-illustration.svg',
    illustrationAlt: 'FraudAware company portal',
    leftDescription:
      'Register your company, post official openings, review applications, and email candidates from your mailbox.',
    requiredAccountType: 'company',
    loginPath: '/company/login',
    registerPath: '/company/register',
    dashboardPath: '/company/dashboard',
    basePath: '/company',
  },
};
