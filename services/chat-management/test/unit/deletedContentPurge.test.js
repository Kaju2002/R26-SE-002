import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockMessageFind, mockMessageUpdateMany, mockReportDistinct, mockDeleteAttachment } =
  vi.hoisted(() => ({
    mockMessageFind: vi.fn(),
    mockMessageUpdateMany: vi.fn(),
    mockReportDistinct: vi.fn(),
    mockDeleteAttachment: vi.fn(),
  }));

vi.mock("../../model/messageModel.js", () => ({
  default: {
    find: (...args) => mockMessageFind(...args),
    updateMany: (...args) => mockMessageUpdateMany(...args),
  },
}));
vi.mock("../../model/chatReportModel.js", () => ({
  default: { distinct: (...args) => mockReportDistinct(...args) },
}));
vi.mock("../../utils/chatImageUpload.js", () => ({
  deleteUploadedAttachment: (...args) => mockDeleteAttachment(...args),
}));

import { runDeletedContentPurge } from "../../jobs/deletedContentPurge.js";

const NOW = new Date("2026-12-31T00:00:00.000Z");

const deletedMessage = (id, extra = {}) => ({
  _id: id,
  messageType: "text",
  attachments: [],
  deletedForEveryone: true,
  deletedAt: new Date("2026-08-01T00:00:00.000Z"),
  ...extra,
});

describe("runDeletedContentPurge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMessageUpdateMany.mockResolvedValue({});
    mockReportDistinct.mockResolvedValue([]);
  });

  afterEach(() => {
    delete process.env.DELETED_MESSAGE_RETENTION_DAYS;
  });

  it("only looks at deleted messages older than the retention window", async () => {
    process.env.DELETED_MESSAGE_RETENTION_DAYS = "30";
    mockMessageFind.mockReturnValue({ limit: vi.fn().mockResolvedValue([]) });

    const summary = await runDeletedContentPurge({ now: NOW });

    const [filter] = mockMessageFind.mock.calls[0];
    expect(filter.deletedForEveryone).toBe(true);
    expect(filter.deletedAt.$lte).toEqual(new Date("2026-12-01T00:00:00.000Z"));
    expect(filter.contentPurgedAt).toBeNull();
    expect(summary).toEqual({ checked: 0, purged: 0, keptForReports: 0 });
  });

  it("wipes content and Cloudinary files but keeps messages cited in reports", async () => {
    mockMessageFind.mockReturnValue({
      limit: vi.fn().mockResolvedValue([
        deletedMessage("msg-old", {
          messageType: "image",
          attachments: [{ url: "https://res.cloudinary.com/x.png", publicId: "chat/x" }],
        }),
        deletedMessage("msg-reported"),
      ]),
    });
    mockReportDistinct.mockResolvedValue(["msg-reported"]);

    const summary = await runDeletedContentPurge({ now: NOW });

    expect(summary).toEqual({ checked: 2, purged: 1, keptForReports: 1 });
    expect(mockDeleteAttachment).toHaveBeenCalledWith("chat/x", "image");

    const [purgeFilter, purgeUpdate] = mockMessageUpdateMany.mock.calls[0];
    expect(purgeFilter._id.$in).toEqual(["msg-old"]);
    expect(purgeUpdate.$set.body).toBe("");
    expect(purgeUpdate.$set.attachments).toEqual([]);
    expect(purgeUpdate.$set.contentPurgedAt).toEqual(NOW);

    const [keepFilter, keepUpdate] = mockMessageUpdateMany.mock.calls[1];
    expect(keepFilter._id.$in).toEqual(["msg-reported"]);
    expect(keepUpdate.$set).toEqual({ retainedForReport: true });
  });
});
