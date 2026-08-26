export type PlatformSettings = {
  requireVerifiedToPublish: boolean;
  fakeJobFlagThreshold: number;
  fakeJobForceCloseEnabled: boolean;
  fakeJobForceCloseThreshold: number;
  features: {
    inchat: boolean;
    employerCheck: boolean;
    analytics: boolean;
    detect: boolean;
  };
  emails: {
    onVerificationDecision: boolean;
    onJobForceClose: boolean;
    onAccountRestricted: boolean;
  };
  maintenanceMode: boolean;
  announcement: string;
};

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  requireVerifiedToPublish: true,
  fakeJobFlagThreshold: 0.7,
  fakeJobForceCloseEnabled: false,
  fakeJobForceCloseThreshold: 0.95,
  features: {
    inchat: true,
    employerCheck: true,
    analytics: true,
    detect: true,
  },
  emails: {
    onVerificationDecision: true,
    onJobForceClose: true,
    onAccountRestricted: true,
  },
  maintenanceMode: false,
  announcement: '',
};

export const ADMIN_SETTINGS_STORAGE_KEY = 'fraudaware.admin.platformSettings';
