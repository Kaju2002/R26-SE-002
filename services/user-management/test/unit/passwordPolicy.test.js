import { describe, expect, it } from "vitest";
import {
  PASSWORD_POLICY_MESSAGE,
  validatePassword,
} from "../../utils/passwordPolicy.js";

describe("passwordPolicy", () => {
  it("accepts a password meeting all policy rules", () => {
    expect(validatePassword("Strong1!")).toEqual({ ok: true });
  });

  it("rejects passwords that are too short", () => {
    const result = validatePassword("Ab1!xy");
    expect(result.ok).toBe(false);
    expect(result.message).toBe(PASSWORD_POLICY_MESSAGE);
  });

  it("rejects passwords missing required character classes", () => {
    expect(validatePassword("strong1!").ok).toBe(false);
    expect(validatePassword("STRONG1!").ok).toBe(false);
    expect(validatePassword("Strong!!").ok).toBe(false);
    expect(validatePassword("Strong12").ok).toBe(false);
  });

  it("rejects empty, null, and undefined passwords", () => {
    expect(validatePassword("").ok).toBe(false);
    expect(validatePassword(null).ok).toBe(false);
    expect(validatePassword(undefined).ok).toBe(false);
  });
});
