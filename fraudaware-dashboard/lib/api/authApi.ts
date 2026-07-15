import { authHeaders, getUserManagementBaseUrl } from './apiConfig';
import type {
  CurrentUserResponse,
  LoginRequest,
  LoginResponse,
  LogoutResponse,
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
