import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFindOneAndUpdate, mockEmitMessageUpdated, mockAnalyzeImage } = vi.hoisted(() => ({
  mockFindOneAndUpdate: vi.fn(),
  mockEmitMessageUpdated: vi.fn(),
  mockAnalyzeImage: vi.fn(),
}));

vi.mock("../../model/messageModel.js", () => ({
  default: { findOneAndUpdate: (...args) => mockFindOneAndUpdate(...args) },
}));
vi.mock("../../config/socket.js", () => ({
  emitMessageUpdated: (...args) => mockEmitMessageUpdated(...args),
}));
vi.mock("../../utils/scamDetectionClient.js", () => ({
  analyzeImageForScam: (...args) => mockAnalyzeImage(...args),
}));

import {
  combineScamAnalyses,
  scanImageAttachmentInBackground,
} from "../../utils/imageScamScan.js";

const analysis = (status, extra = {}) => ({
  status,
  isScam: status === "flagged",
  score: null,
  tactics: [],
  analyzedAt: new Date("2026-08-29T10:00:00.000Z"),
  ...extra,
});

describe("combineScamAnalyses", () => {
  it("uses the image result when there was no caption", () => {
    const image = analysis("flagged", { score: 0.9, tactics: ["urgency"] });
    expect(combineScamAnalyses(analysis("not_checked"), image)).toBe(image);
  });

  it("keeps the caption result when the image had no text", () => {
    const text = analysis("suspicious", { score: 0.6 });
    expect(combineScamAnalyses(text, analysis("not_checked"))).toBe(text);
  });

  it("picks the more serious status and merges tactics", () => {
    const merged = combineScamAnalyses(
      analysis("suspicious", { score: 0.6, tactics: ["fomo"] }),
      analysis("flagged", { score: 0.93, tactics: ["payment_request", "fomo"] })
    );
    expect(merged.status).toBe("flagged");
    expect(merged.isScam).toBe(true);
    expect(merged.score).toBe(0.93);
    expect(merged.tactics).toEqual(["fomo", "payment_request"]);
  });

  it("does not report safe when the image check failed", () => {
    const merged = combineScamAnalyses(analysis("safe"), analysis("error"));
    expect(merged.status).toBe("error");
  });
});

describe("scanImageAttachmentInBackground", () => {
  const file = {
    buffer: Buffer.from([0xff, 0xd8, 0xff]),
    mimetype: "image/jpeg",
    originalname: "offer.jpg",
  };
  const formatMessage = (doc) => ({ id: String(doc._id), scamAnalysis: doc.scamAnalysis });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("saves the merged result and emits message:updated", async () => {
    mockAnalyzeImage.mockResolvedValue(analysis("flagged", { score: 0.9, tactics: ["urgency"] }));
    mockFindOneAndUpdate.mockImplementation(async (_filter, update) => ({
      _id: "msg-1",
      scamAnalysis: update.$set.scamAnalysis,
    }));

    await scanImageAttachmentInBackground({
      messageId: "msg-1",
      conversationId: "conv-1",
      conversation: { jobseekerId: "js-1" },
      file,
      textAnalysis: analysis("not_checked"),
      formatMessage,
    });

    const [filter, update] = mockFindOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ _id: "msg-1", deletedForEveryone: { $ne: true } });
    expect(update.$set.scamAnalysis.status).toBe("flagged");
    expect(mockEmitMessageUpdated).toHaveBeenCalledWith(
      "conv-1",
      expect.objectContaining({ id: "msg-1" }),
      { jobseekerId: "js-1" }
    );
  });

  it("does not emit when the message was deleted meanwhile", async () => {
    mockAnalyzeImage.mockResolvedValue(analysis("safe"));
    mockFindOneAndUpdate.mockResolvedValue(null);

    await scanImageAttachmentInBackground({
      messageId: "msg-1",
      conversationId: "conv-1",
      conversation: null,
      file,
      textAnalysis: analysis("not_checked"),
      formatMessage,
    });

    expect(mockEmitMessageUpdated).not.toHaveBeenCalled();
  });

  it("never throws when the database update fails", async () => {
    mockAnalyzeImage.mockResolvedValue(analysis("safe"));
    mockFindOneAndUpdate.mockRejectedValue(new Error("db down"));

    await expect(
      scanImageAttachmentInBackground({
        messageId: "msg-1",
        conversationId: "conv-1",
        conversation: null,
        file,
        textAnalysis: analysis("not_checked"),
        formatMessage,
      })
    ).resolves.toBeNull();
  });
});
