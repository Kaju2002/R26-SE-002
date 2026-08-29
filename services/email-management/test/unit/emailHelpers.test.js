import { describe, expect, it } from "vitest";
import {
  extractConferenceUrl,
  formatMessageDetail,
  formatMessageSummary,
  normalizeFolderKey,
  resolveConferencingProvider,
} from "../../controller/emailController.js";

describe("normalizeFolderKey", () => {
  it("maps inbox folder names and attributes", () => {
    expect(normalizeFolderKey({ name: "INBOX" })).toBe("inbox");
    expect(normalizeFolderKey({ attributes: ["\\Inbox"] })).toBe("inbox");
  });

  it("maps sent, drafts, spam, and trash variants", () => {
    expect(normalizeFolderKey({ name: "Sent Mail" })).toBe("sent");
    expect(normalizeFolderKey({ name: "Drafts" })).toBe("drafts");
    expect(normalizeFolderKey({ name: "Junk Email" })).toBe("spam");
    expect(normalizeFolderKey({ name: "Deleted Items" })).toBe("trash");
  });

  it("returns null for unrecognized folders", () => {
    expect(normalizeFolderKey({ name: "Archive" })).toBeNull();
    expect(normalizeFolderKey(null)).toBeNull();
  });
});

describe("formatMessageSummary", () => {
  it("formats participants and defaults", () => {
    const summary = formatMessageSummary({
      id: "msg-1",
      subject: "Interview invite",
      snippet: "Hello",
      from: [{ email: "hr@acme.com", name: "HR" }],
      to: ["candidate@example.com"],
      date: 1700000000,
      unread: true,
      attachments: [{ id: "a1" }],
    });

    expect(summary).toMatchObject({
      id: "msg-1",
      subject: "Interview invite",
      snippet: "Hello",
      unread: true,
      hasAttachments: true,
    });
    expect(summary.from[0]).toEqual({ email: "hr@acme.com", name: "HR" });
    expect(summary.to[0]).toEqual({ email: "candidate@example.com", name: null });
  });

  it("uses fallback subject when missing", () => {
    expect(formatMessageSummary({ id: "x" }).subject).toBe("(No subject)");
  });
});

describe("formatMessageDetail", () => {
  it("includes body, cc, bcc, and attachments", () => {
    const detail = formatMessageDetail({
      id: "msg-2",
      body: "<p>Details</p>",
      cc: [{ email: "cc@example.com" }],
      bcc: [],
      folders: ["inbox"],
      attachments: [{ filename: "resume.pdf", size: 1024 }],
    });

    expect(detail.body).toBe("<p>Details</p>");
    expect(detail.cc).toHaveLength(1);
    expect(detail.attachments[0]).toMatchObject({
      filename: "resume.pdf",
      size: 1024,
    });
  });
});

describe("resolveConferencingProvider", () => {
  it("honors explicit provider aliases", () => {
    expect(resolveConferencingProvider("google_meet", null)).toBe("Google Meet");
    expect(resolveConferencingProvider("teams", null)).toBe("Microsoft Teams");
    expect(resolveConferencingProvider("none", null)).toBeNull();
  });

  it("infers Teams for Outlook mailboxes", () => {
    expect(resolveConferencingProvider(null, "recruiter@outlook.com")).toBe(
      "Microsoft Teams"
    );
  });

  it("defaults to Google Meet for Gmail mailboxes", () => {
    expect(resolveConferencingProvider(null, "hr@gmail.com")).toBe("Google Meet");
  });
});

describe("extractConferenceUrl", () => {
  it("reads url from conferencing details", () => {
    expect(
      extractConferenceUrl({
        conferencing: { details: { url: "https://meet.google.com/abc-defg-hij" } },
      })
    ).toBe("https://meet.google.com/abc-defg-hij");
  });

  it("falls back to meeting_url and link", () => {
    expect(
      extractConferenceUrl({
        conferencing: { details: { meeting_url: "https://teams.microsoft.com/l/meetup" } },
      })
    ).toBe("https://teams.microsoft.com/l/meetup");

    expect(
      extractConferenceUrl({
        conferencing: { details: { link: "https://example.com/join" } },
      })
    ).toBe("https://example.com/join");
  });

  it("returns null when conferencing is missing", () => {
    expect(extractConferenceUrl({})).toBeNull();
  });
});
