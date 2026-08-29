import { describe, expect, it } from "vitest";
import {
  buildApplicationThankYouHtml,
  buildApplicationThankYouSubject,
} from "../../config/applicationThankYouTemplate.js";
import {
  buildInterviewReminderHtml,
  buildInterviewReminderSubject,
} from "../../config/interviewEmailTemplate.js";
import { buildHiredEmailHtml } from "../../config/applicationStatusEmailTemplate.js";

describe("buildApplicationThankYouSubject", () => {
  it("includes company and job title", () => {
    expect(buildApplicationThankYouSubject("Acme Ltd", "Analyst")).toBe(
      "Thank you for applying to Acme Ltd | Analyst"
    );
  });
});

describe("buildApplicationThankYouHtml", () => {
  it("escapes HTML in user-provided fields", () => {
    const html = buildApplicationThankYouHtml({
      firstName: "<script>alert(1)</script>",
      jobTitle: "Analyst",
      companyName: "Acme Ltd",
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Analyst");
  });
});

describe("buildInterviewReminderSubject", () => {
  it("uses custom title when provided", () => {
    expect(
      buildInterviewReminderSubject({
        title: "Custom reminder",
        reminderKind: "24h",
        jobTitle: "Analyst",
      })
    ).toBe("Custom reminder");
  });

  it("builds 1h subject when no custom title", () => {
    expect(
      buildInterviewReminderSubject({
        reminderKind: "1h",
        jobTitle: "Analyst",
      })
    ).toMatch(/starting soon/i);
  });
});

describe("buildInterviewReminderHtml", () => {
  it("includes join link when conferenceUrl is provided", () => {
    const html = buildInterviewReminderHtml({
      candidateName: "Jane Doe",
      jobTitle: "Analyst",
      companyName: "Acme Ltd",
      startsAt: "2026-09-01T10:00:00.000Z",
      timezone: "UTC",
      conferenceUrl: "https://meet.example.com/abc",
      body: "Your interview is tomorrow.",
    });

    expect(html).toContain("https://meet.example.com/abc");
    expect(html).toContain("Jane");
  });
});

describe("buildHiredEmailHtml", () => {
  it("includes hire wording for hired status", () => {
    const html = buildHiredEmailHtml({
      firstName: "Jane",
      jobTitle: "Analyst",
      companyName: "Acme Ltd",
    });

    expect(html).toMatch(/hired|congratulations/i);
    expect(html).toContain("Jane");
  });
});
