import { describe, expect, it } from "vitest";
import {
  assertCanPublishJob,
  CompanyVerificationGateError,
  isCompanyVerified,
  isEmployerAccount,
} from "../../utils/companyVerificationGate.js";

const verifiedEmployer = {
  accountType: "company",
  company: { isVerified: true },
};

const unverifiedEmployer = {
  accountType: "company",
  company: { isVerified: false },
};

describe("isEmployerAccount", () => {
  it("returns true for company and recruiter accounts", () => {
    expect(isEmployerAccount({ accountType: "company" })).toBe(true);
    expect(isEmployerAccount({ accountType: "recruiter" })).toBe(true);
  });

  it("returns false for job seekers and admins", () => {
    expect(isEmployerAccount({ accountType: "jobseeker" })).toBe(false);
    expect(isEmployerAccount(null)).toBe(false);
  });
});

describe("isCompanyVerified", () => {
  it("reads company.isVerified from the auth user", () => {
    expect(isCompanyVerified(verifiedEmployer)).toBe(true);
    expect(isCompanyVerified(unverifiedEmployer)).toBe(false);
    expect(isCompanyVerified({ accountType: "company" })).toBe(false);
  });
});

describe("assertCanPublishJob", () => {
  it("allows draft and closed statuses for unverified employers", () => {
    expect(() =>
      assertCanPublishJob(unverifiedEmployer, "draft")
    ).not.toThrow();
    expect(() =>
      assertCanPublishJob(unverifiedEmployer, "closed")
    ).not.toThrow();
  });

  it("blocks publishing active jobs when the company is not verified", () => {
    expect(() =>
      assertCanPublishJob(unverifiedEmployer, "active")
    ).toThrow(CompanyVerificationGateError);

    try {
      assertCanPublishJob(unverifiedEmployer, "active");
    } catch (error) {
      expect(error.code).toBe("COMPANY_NOT_VERIFIED");
      expect(error.status).toBe(403);
    }
  });

  it("allows verified employers to publish active jobs", () => {
    expect(() =>
      assertCanPublishJob(verifiedEmployer, "active")
    ).not.toThrow();
  });

  it("allows editing an already-active job without re-checking verification", () => {
    expect(() =>
      assertCanPublishJob(unverifiedEmployer, "active", {
        previousStatus: "active",
      })
    ).not.toThrow();
  });

  it("blocks republishing from draft or closed when unverified", () => {
    expect(() =>
      assertCanPublishJob(unverifiedEmployer, "active", {
        previousStatus: "draft",
      })
    ).toThrow(CompanyVerificationGateError);

    expect(() =>
      assertCanPublishJob(unverifiedEmployer, "active", {
        previousStatus: "closed",
      })
    ).toThrow(CompanyVerificationGateError);
  });
});
