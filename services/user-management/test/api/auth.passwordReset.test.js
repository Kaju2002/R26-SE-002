import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const { mockFindOne, mockSendMail } = vi.hoisted(() => ({
  mockFindOne: vi.fn(),
  mockSendMail: vi.fn(),
}));

vi.mock("../../config/mongodb.js", () => ({ default: vi.fn() }));
vi.mock("../../model/userModel.js", () => ({
  default: {
    findOne: (...args) => mockFindOne(...args),
  },
}));
vi.mock("../../config/nodemailer.js", () => ({
  default: { sendMail: (...args) => mockSendMail(...args) },
}));
vi.mock("../../utils/publishEvent.js", () => ({ publishEvent: vi.fn() }));
vi.mock("../../utils/companyVerification.js", () => ({
  scheduleHybridCompanyVerification: vi.fn(),
}));

import { createApp } from "../../app.js";

describe("password reset routes", () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSendMail.mockResolvedValue({});
  });

  it("POST /api/auth/forgot-password always returns the same success message", async () => {
    mockFindOne.mockReturnValue({
      select: vi.fn().mockResolvedValue(null),
    });

    const response = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "unknown@example.com" });

    expect(response.status).toBe(200);
    expect(response.body.message).toMatch(/if an account with this email exists/i);
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it("POST /api/auth/forgot-password sends reset email for verified active users", async () => {
    const user = {
      email: "john@example.com",
      emailVerified: true,
      accountStatus: "active",
      save: vi.fn().mockResolvedValue(undefined),
    };
    mockFindOne.mockReturnValue({
      select: vi.fn().mockResolvedValue(user),
    });

    const response = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "john@example.com" });

    expect(response.status).toBe(200);
    expect(user.save).toHaveBeenCalled();
    expect(mockSendMail).toHaveBeenCalledTimes(1);
  });

  it("POST /api/auth/verify-reset-otp rejects invalid codes", async () => {
    mockFindOne.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        emailVerified: true,
        accountStatus: "active",
        passwordResetToken: "123456",
        passwordResetExpires: new Date(Date.now() + 60_000),
      }),
    });

    const response = await request(app).post("/api/auth/verify-reset-otp").send({
      email: "john@example.com",
      otp: "654321",
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/invalid reset code/i);
  });

  it("POST /api/auth/reset-password rejects weak new passwords", async () => {
    const response = await request(app).post("/api/auth/reset-password").send({
      email: "john@example.com",
      otp: "123456",
      password: "weak",
      confirmPassword: "weak",
    });

    expect(response.status).toBe(400);
  });
});
