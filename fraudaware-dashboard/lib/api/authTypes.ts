export type AccountType = 'jobseeker' | 'recruiter' | 'company' | 'superadmin';

export type CompanyProfile = {
  name: string;
  logo?: string | null;
  website?: string | null;
  industry?: string | null;
  address?: string | null;
  description?: string | null;
  registrationNumber?: string | null;
  isVerified?: boolean;
};

export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  avatar?: string;
  headline?: string;
  role?: string;
  location?: string;
  accountStatus: string;
  accountType: AccountType;
  emailVerified: boolean;
  isPremium: boolean;
  lastLoginAt?: string;
  company?: CompanyProfile | null;
  nylasEmail?: string | null;
  nylasConnected?: boolean;
  nylasConnectedAt?: string | null;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginResponse = {
  success: boolean;
  message: string;
  token: string;
  user: AuthUser;
};

export type CurrentUserResponse = {
  success: boolean;
  message: string;
  user: AuthUser;
};

export type LogoutResponse = {
  success: boolean;
  message: string;
};

export type RegisterRecruiterRequest = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  agencyName?: string;
  headline?: string;
};

export type RegisterCompanyRequest = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  companyName: string;
  website?: string;
  industry?: string;
  address?: string;
  description?: string;
  registrationNumber?: string;
};

export type RegisterResponse = {
  success: boolean;
  message: string;
  requiresEmailVerification?: boolean;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    fullName: string;
    accountType: AccountType;
    createdAt?: string;
  };
};

export type VerifyEmailRequest = {
  email: string;
  otp: string;
};
