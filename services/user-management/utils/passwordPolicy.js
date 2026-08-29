export const PASSWORD_POLICY_MESSAGE =
  "Password must be at least 8 characters and include uppercase, lowercase, number, and special character";

/** At least 8 chars with upper, lower, digit, and special. */
export const PASSWORD_POLICY_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export const validatePassword = (password) => {
  const value = String(password ?? "");
  if (!PASSWORD_POLICY_REGEX.test(value)) {
    return { ok: false, message: PASSWORD_POLICY_MESSAGE };
  }
  return { ok: true };
};
