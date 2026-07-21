export type ManagedAccountType = 'jobseeker' | 'recruiter' | 'company';

export type ManagedAccountStatus = 'active' | 'suspended' | 'banned';

export type ManagedUser = {
  id: string;
  fullName: string;
  email: string;
  accountType: ManagedAccountType;
  accountStatus: ManagedAccountStatus;
  emailVerified: boolean;
  organization?: string | null;
  location?: string | null;
  createdAt: string;
  lastLoginAt?: string | null;
};
