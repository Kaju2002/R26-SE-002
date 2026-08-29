export const PASSWORD_POLICY_MESSAGE =
  'Password must be at least 8 characters and include uppercase, lowercase, number, and special character';

export const PASSWORD_POLICY_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export function validatePassword(password: string): { ok: true } | { ok: false; message: string } {
  if (!PASSWORD_POLICY_REGEX.test(String(password ?? ''))) {
    return { ok: false, message: PASSWORD_POLICY_MESSAGE };
  }
  return { ok: true };
}
