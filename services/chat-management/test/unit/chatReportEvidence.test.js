import { describe, expect, it } from "vitest";
import {
  buildEvidencePack,
  riskFromScore,
} from "../../controller/chatReportController.js";

describe("riskFromScore", () => {
  it("returns high for scores at or above 0.9", () => {
    expect(riskFromScore(0.9)).toBe("high");
    expect(riskFromScore(0.95)).toBe("high");
  });

  it("returns caution for lower or missing scores", () => {
    expect(riskFromScore(0.5)).toBe("caution");
    expect(riskFromScore(null)).toBe("caution");
  });
});

describe("buildEvidencePack", () => {
  const conversation = {
    recruiterId: "recruiter-1",
    jobseekerId: "jobseeker-1",
  };

  it("summarizes flagged recruiter messages and tactics", () => {
    const pack = buildEvidencePack(conversation, [
      {
        _id: "msg-1",
        senderId: "recruiter-1",
        messageType: "text",
        body: "Hello there",
        createdAt: new Date("2026-08-29T10:00:00.000Z"),
        scamAnalysis: { status: "not_checked", isScam: false },
      },
      {
        _id: "msg-2",
        senderId: "recruiter-1",
        messageType: "text",
        body: "Pay GHS 200 registration fee via Mobile Money",
        createdAt: new Date("2026-08-29T10:05:00.000Z"),
        scamAnalysis: {
          status: "flagged",
          isScam: true,
          score: 0.95,
          tactics: ["payment_request"],
        },
      },
    ]);

    expect(pack.flaggedCount).toBe(1);
    expect(pack.maxScore).toBe(0.95);
    expect(pack.riskLevel).toBe("high");
    expect(pack.tacticsSummary).toContain("payment_request");
    expect(pack.evidenceMessages[1].role).toBe("recruiter");
    expect(pack.timeline).toHaveLength(1);
  });

  it("creates a fallback timeline when no messages were flagged", () => {
    const pack = buildEvidencePack(conversation, [
      {
        _id: "msg-1",
        senderId: "jobseeker-1",
        messageType: "text",
        body: "Thanks for the update",
        createdAt: new Date("2026-08-29T10:00:00.000Z"),
        scamAnalysis: { status: "not_checked", isScam: false },
      },
    ]);

    expect(pack.flaggedCount).toBe(0);
    expect(pack.riskLevel).toBe("caution");
    expect(pack.timeline[0].label).toMatch(/reported by jobseeker/i);
  });
});
