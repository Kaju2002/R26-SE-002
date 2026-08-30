import { describe, expect, it } from "vitest";
import {
  buildLogoFallback,
  formatJob,
  formatModeratedJob,
} from "../../utils/jobFormatter.js";
import { formatApplication } from "../../utils/applicationFormatter.js";
import {
  buildResumeDownloadUrl,
  resolveResumeFilename,
} from "../../utils/resumeUrlHelper.js";

describe("buildLogoFallback", () => {
  it("returns initials and palette for company names", () => {
    const fallback = buildLogoFallback("Acme Labs");

    expect(fallback.text).toBe("AL");
    expect(fallback.bg).toMatch(/^#/);
    expect(fallback.color).toMatch(/^#/);
  });

  it("returns undefined for blank names", () => {
    expect(buildLogoFallback("")).toBeUndefined();
    expect(buildLogoFallback("   ")).toBeUndefined();
  });
});

describe("formatJob", () => {
  it("shapes a mongo job for frontend consumption", () => {
    const formatted = formatJob({
      _id: "507f1f77bcf86cd799439011",
      title: "Analyst",
      companyName: "Acme Ltd",
      location: "Accra",
      salaryCurrency: "GHS",
      salaryPeriod: "month",
      postedAt: new Date("2026-01-01T00:00:00.000Z"),
      isVerified: true,
      status: "active",
      postedBy: "recruiter-1",
    });

    expect(formatted.id).toBe("507f1f77bcf86cd799439011");
    expect(formatted.salaryCurrency).toBe("GH¢");
    expect(formatted.salaryPeriod).toBe("/mo");
    expect(formatted.isVerified).toBe(true);
    expect(formatted.companyFallback?.text).toBe("AL");
  });

  it("returns null for missing jobs", () => {
    expect(formatJob(null)).toBeNull();
  });
});

describe("formatModeratedJob", () => {
  it("includes moderation and risk fields for admin views", () => {
    const formatted = formatModeratedJob({
      _id: "507f1f77bcf86cd799439011",
      title: "Analyst",
      companyName: "Acme Ltd",
      status: "pending_review",
      moderationStatus: "flagged",
      riskCheck: {
        prediction: "fake",
        fakeProbability: 0.91,
        message: "Flagged",
        text: { prediction: "fake", fakeProbability: 0.91 },
        image: { prediction: "skipped" },
      },
    });

    expect(formatted.listingStatus).toBe("pending_review");
    expect(formatted.fakeJobScore).toBe(0.91);
    expect(formatted.riskPrediction).toBe("fake");
    expect(formatted.riskSummary).toContain("[fake-job]");
  });
});

describe("formatApplication", () => {
  it("builds application list items with resume download url", () => {
    const resumeUrl =
      "https://res.cloudinary.com/demo/image/upload/v1/resume.pdf";
    const formatted = formatApplication(
      {
        _id: "507f1f77bcf86cd799439012",
        jobId: "507f1f77bcf86cd799439011",
        status: "applied",
        fullName: "Jane Doe",
        email: "jane@example.com",
        resumeUrl,
        resumeName: "Jane Resume.pdf",
        appliedAt: new Date("2026-02-01T00:00:00.000Z"),
      },
      { title: "Analyst", companyName: "Acme Ltd" }
    );

    expect(formatted.jobTitle).toBe("Analyst");
    expect(formatted.fullName).toBe("Jane Doe");
    expect(formatted.resumeDownloadUrl).toContain("fl_attachment:");
  });
});

describe("resumeUrlHelper", () => {
  it("sanitizes resume filenames and adds pdf extension when missing", () => {
    expect(resolveResumeFilename("My Resume", null)).toBe("My_Resume.pdf");
  });

  it("inserts Cloudinary attachment transformation", () => {
    const url =
      "https://res.cloudinary.com/demo/image/upload/v123/resume.pdf";
    const downloadUrl = buildResumeDownloadUrl(url, "resume.pdf");

    expect(downloadUrl).toContain("fl_attachment:resume.pdf/");
  });
});
