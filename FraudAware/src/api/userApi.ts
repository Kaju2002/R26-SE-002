import { getUserManagementBaseUrl } from './apiConfig';

// ============ TYPES ============
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  token: string;
  user: {
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
    emailVerified: boolean;
    isPremium: boolean;
    lastLoginAt: string;
  };
}

export interface RegisterRequest {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface RegisterResponse {
  success: boolean;
  message: string;
  requiresEmailVerification?: boolean;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    fullName: string;
    createdAt: string;
  };
}

export interface VerifyEmailOtpRequest {
  email: string;
  otp: string;
}

export interface VerifyEmailOtpResponse {
  success: boolean;
  message: string;
}

export interface ResendVerificationOtpResponse {
  success: boolean;
  message: string;
}

export interface LogoutResponse {
  success: boolean;
  message: string;
  note: string;
  lastActivityAt: string;
}

// ============ LOGIN API ============
export const loginUser = async (credentials: LoginRequest): Promise<LoginResponse> => {
  try {
    const response = await fetch(`${getUserManagementBaseUrl()}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Login failed");
    }

    const data: LoginResponse = await response.json();
    return data;
  } catch (error) {
    throw error instanceof Error ? error : new Error("Login API error");
  }
};

// ============ REGISTER API ============
export const registerUser = async (userData: RegisterRequest): Promise<RegisterResponse> => {
  try {
    const response = await fetch(`${getUserManagementBaseUrl()}/api/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Registration failed");
    }

    const data: RegisterResponse = await response.json();
    return data;
  } catch (error) {
    throw error instanceof Error ? error : new Error("Register API error");
  }
};

// ============ VERIFY EMAIL OTP API ============
export const verifyEmailOtp = async (
  payload: VerifyEmailOtpRequest
): Promise<VerifyEmailOtpResponse> => {
  try {
    const response = await fetch(`${getUserManagementBaseUrl()}/api/auth/verify-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "OTP verification failed");
    }

    const data: VerifyEmailOtpResponse = await response.json();
    return data;
  } catch (error) {
    throw error instanceof Error ? error : new Error("Verify email API error");
  }
};

// ============ RESEND EMAIL OTP API ============
export const resendVerificationOtp = async (
  email: string
): Promise<ResendVerificationOtpResponse> => {
  try {
    const response = await fetch(`${getUserManagementBaseUrl()}/api/auth/resend-verification-otp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Resend OTP failed");
    }

    const data: ResendVerificationOtpResponse = await response.json();
    return data;
  } catch (error) {
    throw error instanceof Error ? error : new Error("Resend OTP API error");
  }
};

// ============ LOGOUT API ============
export const logoutUser = async (token: string): Promise<LogoutResponse> => {
  try {
    const response = await fetch(`${getUserManagementBaseUrl()}/api/auth/logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Logout failed");
    }

    const data: LogoutResponse = await response.json();
    return data;
  } catch (error) {
    throw error instanceof Error ? error : new Error("Logout API error");
  }
};

