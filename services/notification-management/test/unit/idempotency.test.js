import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFindOne } = vi.hoisted(() => ({
  mockFindOne: vi.fn(),
}));

vi.mock("../../model/notificationModel.js", () => ({
  default: {
    findOne: (...args) => mockFindOne(...args),
  },
  NOTIFICATION_CATEGORIES: ["general", "applications"],
}));

import {
  findApplicationNotification,
  hasProcessedEvent,
} from "../../utils/idempotency.js";

describe("hasProcessedEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false when sourceEventId is missing", async () => {
    expect(await hasProcessedEvent(null)).toBe(false);
    expect(mockFindOne).not.toHaveBeenCalled();
  });

  it("returns true when a notification already used the event id", async () => {
    mockFindOne.mockReturnValue({
      select: vi.fn().mockResolvedValue({ _id: "existing" }),
    });

    expect(await hasProcessedEvent("evt-1")).toBe(true);
  });

  it("returns false when no notification matches the event id", async () => {
    mockFindOne.mockReturnValue({
      select: vi.fn().mockResolvedValue(null),
    });

    expect(await hasProcessedEvent("evt-2")).toBe(false);
  });
});

describe("findApplicationNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when userId or applicationId is missing", async () => {
    expect(await findApplicationNotification("", "app-1")).toBeNull();
    expect(await findApplicationNotification("user-1", "")).toBeNull();
  });

  it("queries applications category by user and application id", async () => {
    const doc = { _id: "notif-1" };
    mockFindOne.mockResolvedValue(doc);

    const result = await findApplicationNotification("user-1", "app-1");

    expect(result).toBe(doc);
    expect(mockFindOne).toHaveBeenCalledWith({
      userId: "user-1",
      category: "applications",
      "metadata.applicationId": "app-1",
    });
  });
});
