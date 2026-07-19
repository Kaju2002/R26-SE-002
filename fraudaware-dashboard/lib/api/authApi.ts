import { authHeaders, getUserManagementBaseUrl } from './apiConfig';
import type {
  CurrentUserResponse,
  LoginRequest,
  LoginResponse,
  LogoutResponse,
  RegisterCompanyRequest,
  RegisterRecruiterRequest,
  RegisterResponse,
  VerifyEmailRequest,
} from './authTypes';

async function parseJson<T>(response: Response): Promise<T> {
  let data: Record<string, unknown> = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    const message =
      typeof data.message === 'string' ? data.message : `Request failed (${response.status})`;
    throw new Error(message);
  }

  return data as T;
}

export async function login(credentials: LoginRequest): Promise<LoginResponse> {
  const response = await fetch(`${getUserManagementBaseUrl()}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });

  return parseJson<LoginResponse>(response);
}

export async function registerRecruiter(
  payload: RegisterRecruiterRequest
): Promise<RegisterResponse> {
  const response = await fetch(
    `${getUserManagementBaseUrl()}/api/auth/register-recruiter`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );

  return parseJson<RegisterResponse>(response);
}

export async function registerCompany(
  payload: RegisterCompanyRequest
): Promise<RegisterResponse> {
  const response = await fetch(
    `${getUserManagementBaseUrl()}/api/auth/register-company`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );

  return parseJson<RegisterResponse>(response);
}

export async function verifyEmail(payload: VerifyEmailRequest): Promise<{
  success: boolean;
  message: string;
}> {
  const response = await fetch(`${getUserManagementBaseUrl()}/api/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return parseJson(response);
}

export async function getCurrentUser(token: string): Promise<CurrentUserResponse> {
  const response = await fetch(`${getUserManagementBaseUrl()}/api/auth/me`, {
    method: 'GET',
    headers: authHeaders(token),
  });

  return parseJson<CurrentUserResponse>(response);
}

export async function logout(token: string): Promise<LogoutResponse> {
  const response = await fetch(`${getUserManagementBaseUrl()}/api/auth/logout`, {
    method: 'POST',
    headers: authHeaders(token),
  });

  return parseJson<LogoutResponse>(response);
}
