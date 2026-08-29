import { describe, expect, it } from "vitest";
import {
  FORGOT_PASSWORD_SUCCESS_MESSAGE,
  canRequestPasswordReset,
  isValidEmail,
  isValidOtp,
  normalizeEmail,
  normalizeOtp,
  parseFullNameParts,
  validatePasswordResetOtp,
  validateRegistrationCredentials,
} from "../../utils/authValidation.js";

describe("authValidation", () => {
  it("normalizes email and otp input", () => {
    expect(normalizeEmail("  User@Example.COM  ")).toBe("user@example.com");
    expect(normalizeOtp("  123456  ")).toBe("123456");
  });

  it("validates email and otp formats", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidOtp("123456")).toBe(true);
    expect(isValidOtp("12345")).toBe(false);
  });

  it("parses full names into first and last parts", () => {
    const result = parseFullNameParts("Jane Marie Doe");
    expect(result).toMatchObject({
      ok: true,
      firstName: "Jane",
      lastName: "Marie Doe",
    });
    expect(parseFullNameParts("Madonna").ok).toBe(false);
  });

  it("validates registration credentials", () => {
    const valid = validateRegistrationCredentials({
      fullName: "John Doe",
      email: "John@Example.com",
      password: "Secure1!",
      confirmPassword: "Secure1!",
    });
    expect(valid.ok).toBe(true);
    expect(valid.email).toBe("john@example.com");

    const weak = validateRegistrationCredentials({
      fullName: "John Doe",
      email: "john@example.com",
      password: "weak",
      confirmPassword: "weak",
    });
    expect(weak.ok).toBe(false);

    const mismatch = validateRegistrationCredentials({
      fullName: "John Doe",
      email: "john@example.com",
      password: "Secure1!",
      confirmPassword: "Secure2!",
    });
    expect(mismatch.ok).toBe(false);
  });

  it("gates password reset requests to verified active users", () => {
    expect(
      canRequestPasswordReset({ emailVerified: true, accountStatus: "active" })
    ).toBe(true);
    expect(
      canRequestPasswordReset({ emailVerified: false, accountStatus: "active" })
    ).toBe(false);
    expect(canRequestPasswordReset(null)).toBe(false);
  });

  it("validates password reset otp expiry and code", () => {
    const now = Date.parse("2026-08-29T12:00:00.000Z");
    expect(
      validatePasswordResetOtp(
        {
          passwordResetToken: "123456",
          passwordResetExpires: new Date(now + 60_000),
        },
        "123456",
        now
      ).ok
    ).toBe(true);

    expect(
      validatePasswordResetOtp(
        {
          passwordResetToken: "123456",
          passwordResetExpires: new Date(now - 1),
        },
        "123456",
        now
      ).ok
    ).toBe(false);

    expect(
      validatePasswordResetOtp(
        {
          passwordResetToken: "123456",
          passwordResetExpires: new Date(now + 60_000),
        },
        "654321",
        now
      ).message
    ).toMatch(/invalid reset code/i);
  });

  it("uses a non-enumerating forgot-password message", () => {
    expect(FORGOT_PASSWORD_SUCCESS_MESSAGE).toMatch(
      /if an account with this email exists/i
    );
  });
});
