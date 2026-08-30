import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const TEST_BEARER = "test-session-token";

const {
  mockValidateUserSession,
  mockPushTokenFindOneAndUpdate,
  mockPushTokenDeleteOne,
} = vi.hoisted(() => ({
  mockValidateUserSession: vi.fn(),
  mockPushTokenFindOneAndUpdate: vi.fn(),
  mockPushTokenDeleteOne: vi.fn(),
}));

vi.mock("../../config/mongodb.js", () => ({ default: vi.fn() }));
vi.mock("../../utils/userManagementClient.js", () => ({
  validateUserSession: (...args) => mockValidateUserSession(...args),
}));
vi.mock("../../model/pushTokenModel.js", () => ({
  default: {
    findOneAndUpdate: (...args) => mockPushTokenFindOneAndUpdate(...args),
    deleteOne: (...args) => mockPushTokenDeleteOne(...args),
  },
}));

import { createApp } from "../../app.js";

const authHeader = () => ({ Authorization: `Bearer ${TEST_BEARER}` });

describe("push token API", () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateUserSession.mockResolvedValue({
      ok: true,
      user: { id: "user-1", email: "user@example.com", accountType: "jobseeker" },
    });
    mockPushTokenFindOneAndUpdate.mockResolvedValue({
      _id: "device-1",
      platform: "android",
      updatedAt: new Date("2026-08-29T10:00:00.000Z"),
    });
    mockPushTokenDeleteOne.mockResolvedValue({ deletedCount: 1 });
  });

  it("returns 400 when token is missing", async () => {
    const response = await request(app)
      .post("/api/notifications/push-token")
      .set(authHeader())
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/token is required/i);
  });

  it("returns 400 for invalid Expo push token format", async () => {
    const response = await request(app)
      .post("/api/notifications/push-token")
      .set(authHeader())
      .send({ token: "not-a-valid-token" });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/invalid expo push token/i);
  });

  it("registers a valid Expo push token", async () => {
    const response = await request(app)
      .post("/api/notifications/push-token")
      .set(authHeader())
      .send({
        token: "ExponentPushToken[abc123]",
        platform: "android",
        deviceName: "Pixel",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.device.platform).toBe("android");
    expect(mockPushTokenFindOneAndUpdate).toHaveBeenCalled();
  });

  it("removes a registered push token", async () => {
    const response = await request(app)
      .delete("/api/notifications/push-token")
      .set(authHeader())
      .send({ token: "ExponentPushToken[abc123]" });

    expect(response.status).toBe(200);
    expect(response.body.message).toMatch(/removed/i);
    expect(mockPushTokenDeleteOne).toHaveBeenCalledWith({
      userId: "user-1",
      token: "ExponentPushToken[abc123]",
    });
  });
});
