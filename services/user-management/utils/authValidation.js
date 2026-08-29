import { validatePassword } from "./passwordPolicy.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const FORGOT_PASSWORD_SUCCESS_MESSAGE =
  "If an account with this email exists, a password reset code has been sent.";

export const normalizeEmail = (email) => email.toLowerCase().trim();

export const normalizeOtp = (otp) => String(otp).trim();

export const isValidEmail = (email) => EMAIL_REGEX.test(email);

export const isValidOtp = (otp) => /^\d{6}$/.test(normalizeOtp(otp));

export const parseFullNameParts = (fullName) => {
  const nameTrimed = String(fullName || "").trim();
  if (nameTrimed.length < 2) {
    return { ok: false, message: "Full name must be at least 2 characters" };
  }

  const nameParts = nameTrimed.split(/\s+/).filter(Boolean);
  if (nameParts.length < 2) {
    return {
      ok: false,
      message: "Please enter full name (first and last name)",
    };
  }

  return {
    ok: true,
    firstName: nameParts[0],
    lastName: nameParts.slice(1).join(" "),
    fullName: nameTrimed,
  };
};

export const validateRegistrationCredentials = ({
  fullName,
  email,
  password,
  confirmPassword,
}) => {
  if (!fullName || !email || !password || !confirmPassword) {
    return {
      ok: false,
      message: "Full name, email, password, and confirm password are required",
    };
  }

  const parsedName = parseFullNameParts(fullName);
  if (!parsedName.ok) return parsedName;

  if (!isValidEmail(email)) {
    return { ok: false, message: "Please enter a valid email address" };
  }

  const passwordCheck = validatePassword(password);
  if (!passwordCheck.ok) {
    return passwordCheck;
  }

  if (password !== confirmPassword) {
    return { ok: false, message: "Passwords do not match" };
  }

  return {
    ok: true,
    firstName: parsedName.firstName,
    lastName: parsedName.lastName,
    email: normalizeEmail(email),
  };
};

export const canRequestPasswordReset = (user) =>
  Boolean(
    user && user.emailVerified === true && user.accountStatus === "active"
  );

export const validatePasswordResetOtp = (user, normalizedOtp, now = Date.now()) => {
  if (
    !user?.passwordResetToken ||
    !user?.passwordResetExpires ||
    user.passwordResetExpires.getTime() < now
  ) {
    return {
      ok: false,
      status: 400,
      message: "Reset code is expired. Please request a new code.",
    };
  }

  if (user.passwordResetToken !== normalizedOtp) {
    return {
      ok: false,
      status: 400,
      message: "Invalid reset code",
    };
  }

  return { ok: true };
};
