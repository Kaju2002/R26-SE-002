import { describe, expect, it } from "vitest";
import {
  buildInterviewInviteHtml,
  buildInterviewInviteSubject,
} from "../../config/interviewInviteTemplate.js";

describe("buildInterviewInviteSubject", () => {
  it("includes company name when available", () => {
    expect(buildInterviewInviteSubject("Analyst", "Acme Ltd")).toBe(
      "Interview invitation: Analyst at Acme Ltd"
    );
  });

  it("falls back when company name is missing", () => {
    expect(buildInterviewInviteSubject("Analyst", "")).toBe(
      "Interview invitation: Analyst"
    );
  });
});

describe("buildInterviewInviteHtml", () => {
  it("escapes HTML in candidate and notes fields", () => {
    const html = buildInterviewInviteHtml({
      candidateName: "<script>alert(1)</script>",
      jobTitle: "Analyst",
      companyName: "Acme Ltd",
      startsAt: "2026-09-01T10:00:00.000Z",
      timezone: "UTC",
      type: "video",
      notes: "<b>Bring ID</b>",
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;b&gt;Bring ID&lt;/b&gt;");
  });

  it("includes join link block when conferenceUrl is provided", () => {
    const html = buildInterviewInviteHtml({
      candidateName: "Jane Doe",
      jobTitle: "Analyst",
      companyName: "Acme Ltd",
      startsAt: "2026-09-01T10:00:00.000Z",
      timezone: "UTC",
      type: "video",
      conferenceUrl: "https://meet.example.com/abc",
    });

    expect(html).toContain("Join interview");
    expect(html).toContain("https://meet.example.com/abc");
  });

  it("labels onsite interviews correctly", () => {
    const html = buildInterviewInviteHtml({
      candidateName: "Jane Doe",
      jobTitle: "Analyst",
      companyName: "Acme Ltd",
      startsAt: "2026-09-01T10:00:00.000Z",
      timezone: "UTC",
      type: "onsite",
      location: "Head office",
    });

    expect(html).toContain("On-site interview");
    expect(html).toContain("Head office");
  });
});
