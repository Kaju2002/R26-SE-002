export type RootStackParamList = {
  Launch: undefined;
  Onboarding: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  CodeSent: { email?: string } | undefined;
  Verification: { email?: string; flow: 'register' | 'reset' } | undefined;
  RegistrationSuccess: undefined;
  NewPassword: { email?: string; otp?: string } | undefined;
  PasswordUpdated: undefined;
  MainTabs:
    | {
        screen?: 'Home' | 'Detect' | 'Applications' | 'Chat' | 'Jobs';
        params?: Record<string, unknown>;
      }
    | undefined;
  Profile: undefined;
  EditProfile: undefined;
  EditWorkExperience: { itemId?: string } | undefined;
  EditEducation: { itemId?: string } | undefined;
  EditLanguage: { itemId?: string } | undefined;
  Bookmarks: undefined;
  Notifications: { initialTab?: 'general' | 'applications' };
  JobDetails: { jobId: string };
  ApplyJob: { jobId: string };
  RecruiterProfile: { recruiterId: string; jobId?: string };

  SafeJobRecommendations: undefined;
};
