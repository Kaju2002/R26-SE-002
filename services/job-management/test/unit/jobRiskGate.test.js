import { describe, expect, it } from "vitest";
import {
  applyRiskDecision,
  buildJobRiskText,
  combineRiskResults,
  createJobStatusMessage,
  formatPercent,
  formatRiskSummaryLine,
  updateJobStatusMessage,
} from "../../utils/jobRiskGate.js";

describe("buildJobRiskText", () => {
  it("includes title, company, skills, and salary in listing text", () => {
    const text = buildJobRiskText({
      title: "Python Developer",
      companyName: "Acme Ltd",
      location: "Accra",
      type: "Full-Time",
      mode: "Remote",
      salaryMin: 3000,
      salaryMax: 5000,
      salaryCurrency: "GHS",
      salaryPeriod: "month",
      skills: ["python", "django"],
      description: "Build APIs",
      contact: { email: "hr@acme.com", website: "acme.com" },
      endsAt: "2026-12-31",
    });

    expect(text).toContain("Title: Python Developer");
    expect(text).toContain("Company: Acme Ltd");
    expect(text).toContain("Skills: python, django");
    expect(text).toContain("Salary:");
    expect(text).toContain("Contact:");
    expect(text).toContain("Closing date:");
  });
});

describe("combineRiskResults", () => {
  it("returns legitimate when text and image are clean", () => {
    const result = combineRiskResults(
      { prediction: "legitimate", fakeProbability: 0.1 },
      { prediction: "skipped", message: "no poster" }
    );

    expect(result.prediction).toBe("legitimate");
    expect(result.flagReasons).toEqual([]);
  });

  it("flags when text is suspicious", () => {
    const result = combineRiskResults(
      { prediction: "suspicious", fakeProbability: 0.7 },
      { prediction: "skipped" }
    );

    expect(result.prediction).toBe("suspicious");
    expect(result.flagReasons).toContain("fake_job_model");
  });

  it("picks the worse prediction when both text and poster are flagged", () => {
    const result = combineRiskResults(
      { prediction: "suspicious", fakeProbability: 0.6 },
      { prediction: "fake", fakeProbability: 0.9 }
    );

    expect(result.prediction).toBe("fake");
    expect(result.flagReasons).toEqual(["fake_job_model", "fake_job_poster"]);
    expect(result.message).toMatch(/both the listing text and the poster/i);
  });
});

describe("applyRiskDecision", () => {
  it("activates legitimate jobs requested as active", () => {
    expect(applyRiskDecision("active", { prediction: "legitimate" })).toEqual({
      status: "active",
      isVerified: true,
      moderationStatus: "none",
      flagReasons: [],
    });
  });

  it("holds fake jobs for admin review", () => {
    expect(
      applyRiskDecision("active", {
        prediction: "fake",
        flagReasons: ["fake_job_model"],
      })
    ).toEqual({
      status: "pending_review",
      isVerified: false,
      moderationStatus: "flagged",
      flagReasons: ["fake_job_model"],
    });
  });

  it("keeps closed jobs closed even when flagged", () => {
    const decision = applyRiskDecision("closed", { prediction: "fake" });
    expect(decision.status).toBe("closed");
    expect(decision.moderationStatus).toBe("force_closed");
  });

  it("allows draft saves for legitimate listings", () => {
    expect(applyRiskDecision("draft", { prediction: "legitimate" }).status).toBe(
      "draft"
    );
  });
});

describe("formatPercent", () => {
  it("formats finite numbers as whole percentages", () => {
    expect(formatPercent(0.876)).toBe("88%");
  });

  it("returns n/a for non-numeric values", () => {
    expect(formatPercent(null)).toBe("n/a");
    expect(formatPercent("bad")).toBe("n/a");
  });
});

describe("formatRiskSummaryLine", () => {
  it("builds a readable combined risk summary", () => {
    const line = formatRiskSummaryLine(
      { title: "Analyst" },
      { fakeProbability: 0.2, prediction: "legitimate" },
      { fakeProbability: 0.8, prediction: "fake" },
      { prediction: "fake" }
    );

    expect(line).toContain('"Analyst"');
    expect(line).toContain("combined=fake");
  });
});

describe("job status messages", () => {
  it("returns review message for pending_review", () => {
    expect(createJobStatusMessage("pending_review")).toMatch(/admin review/i);
    expect(updateJobStatusMessage("pending_review")).toMatch(/admin review/i);
  });

  it("returns success message for active jobs", () => {
    expect(createJobStatusMessage("active")).toMatch(/created successfully/i);
    expect(updateJobStatusMessage("active")).toMatch(/updated successfully/i);
  });
});
