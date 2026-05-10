export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  CodeSent: { email?: string } | undefined;
  Verification: { email?: string; flow: 'register' | 'reset' } | undefined;
  RegistrationSuccess: undefined;
  NewPassword: { email?: string } | undefined;
  PasswordUpdated: undefined;
  MainTabs: undefined;
  Profile: undefined;
  EditProfile: undefined;
  Bookmarks: undefined;
  Notifications: { initialTab?: 'general' | 'applications' };
  JobDetails: { jobId: string };
  ApplyJob: { jobId: string };

  SafeJobRecommendations: undefined;
};
