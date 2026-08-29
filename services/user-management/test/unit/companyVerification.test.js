import { describe, expect, it } from "vitest";
import {
  mapPredictToVerificationFields,
  mapUnavailableVerificationFields,
} from "../../utils/companyVerification.js";

const sampleUser = {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@acme.test",
  company: {
    name: "Acme Labs",
    registrationNumber: "PV-12345",
    website: "https://acme.test",
    industry: "Technology",
    address: "Colombo",
  },
};

describe("companyVerification mapping", () => {
  it("marks low-risk registered employers auto eligible", () => {
    const fields = mapPredictToVerificationFields(
      {
        risk_level: "low",
        registration_status: "registered",
        confidence: "high",
        prediction: "legitimate",
        risk_score: 85,
        registration_sources: ["cse_registry"],
        recommendation: "Looks legitimate.",
      },
      sampleUser
    );

    expect(fields.autoEligible).toBe(true);
    expect(fields.companyName).toBe("Acme Labs");
    expect(fields.riskScore).toBeLessThan(0.3);
    expect(fields.registrySignals.some((signal) => signal.source === "CSE")).toBe(
      true
    );
  });

  it("rejects fake high-risk predictions", () => {
    const fields = mapPredictToVerificationFields(
      {
        risk_level: "high",
        registration_status: "not_found",
        confidence: "medium",
        prediction: "fake",
        warning: "Registry mismatch.",
      },
      sampleUser
    );

    expect(fields.autoEligible).toBe(false);
    expect(fields.riskScore).toBeGreaterThanOrEqual(0.45);
  });

  it("converts legitimacy score to admin risk score", () => {
    const fields = mapPredictToVerificationFields(
      {
        risk_level: "medium",
        registration_status: "registered",
        confidence: "medium",
        prediction: "legitimate",
        risk_score: 80,
      },
      sampleUser
    );

    expect(Math.abs(fields.riskScore - 0.2)).toBeLessThan(0.0001);
  });

  it("queues manual review when verification service is unavailable", () => {
    const fields = mapUnavailableVerificationFields(sampleUser, "Service unavailable");

    expect(fields.autoEligible).toBe(false);
    expect(fields.summary).toMatch(/manual admin review/i);
    expect(fields.registrySignals[0].found).toBe(false);
  });
});
