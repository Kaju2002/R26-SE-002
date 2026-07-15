export type AccountType = 'jobseeker' | 'recruiter' | 'superadmin';

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
