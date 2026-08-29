import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const NOTIFICATION_ID = "507f1f77bcf86cd799439011";
const TEST_BEARER = "test-session-token";

const {
  mockValidateUserSession,
  mockNotificationFind,
  mockNotificationCountDocuments,
  mockNotificationFindOneAndUpdate,
} = vi.hoisted(() => ({
  mockValidateUserSession: vi.fn(),
  mockNotificationFind: vi.fn(),
  mockNotificationCountDocuments: vi.fn(),
  mockNotificationFindOneAndUpdate: vi.fn(),
}));

vi.mock("../../config/mongodb.js", () => ({ default: vi.fn() }));
vi.mock("../../utils/userManagementClient.js", () => ({
  validateUserSession: (...args) => mockValidateUserSession(...args),
}));
vi.mock("../../model/notificationModel.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: {
      find: (...args) => mockNotificationFind(...args),
      countDocuments: (...args) => mockNotificationCountDocuments(...args),
      findOneAndUpdate: (...args) => mockNotificationFindOneAndUpdate(...args),
      findOneAndDelete: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  };
});

import { createApp } from "../../app.js";

const authHeader = () => ({ Authorization: `Bearer ${TEST_BEARER}` });

describe("notification API", () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateUserSession.mockResolvedValue({
      ok: true,
      user: { id: "user-1", email: "user@example.com", accountType: "jobseeker" },
    });
    mockNotificationFind.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        skip: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            {
              _id: NOTIFICATION_ID,
              category: "general",
              type: "system",
              title: "Hello",
              body: "World",
              read: false,
              createdAt: new Date("2026-08-29T10:00:00.000Z"),
              metadata: {},
            },
          ]),
        }),
      }),
    });
    mockNotificationCountDocuments.mockResolvedValue(1);
  });

  it("returns 401 without auth", async () => {
    mockValidateUserSession.mockResolvedValue({
      ok: false,
      status: 401,
      message: "No token provided. Please login.",
    });

    const response = await request(app).get("/api/notifications");
    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid category filter", async () => {
    const response = await request(app)
      .get("/api/notifications?category=invalid")
      .set(authHeader());

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/invalid category/i);
  });

  it("lists notifications for authenticated users", async () => {
    const response = await request(app)
      .get("/api/notifications")
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.notifications).toHaveLength(1);
    expect(response.body.notifications[0].title).toBe("Hello");
  });

  it("returns unread count excluding chat notifications", async () => {
    mockNotificationCountDocuments.mockResolvedValue(3);

    const response = await request(app)
      .get("/api/notifications/unread-count")
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body.unreadCount).toBe(3);
    expect(mockNotificationCountDocuments).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        read: false,
        type: { $ne: "chat" },
      })
    );
  });

  it("marks a notification as read", async () => {
    mockNotificationFindOneAndUpdate.mockResolvedValue({
      _id: NOTIFICATION_ID,
      read: true,
    });

    const response = await request(app)
      .patch(`/api/notifications/${NOTIFICATION_ID}/read`)
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body.message).toMatch(/marked as read/i);
  });

  it("returns 404 when marking a missing notification", async () => {
    mockNotificationFindOneAndUpdate.mockResolvedValue(null);

    const response = await request(app)
      .patch(`/api/notifications/${NOTIFICATION_ID}/read`)
      .set(authHeader());

    expect(response.status).toBe(404);
  });
});
