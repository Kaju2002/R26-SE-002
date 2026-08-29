import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const { mockFindOne } = vi.hoisted(() => ({
  mockFindOne: vi.fn(),
}));

vi.mock("../../config/mongodb.js", () => ({ default: vi.fn() }));
vi.mock("../../model/userModel.js", () => ({
  default: {
    findOne: (...args) => mockFindOne(...args),
  },
}));
vi.mock("../../config/nodemailer.js", () => ({
  default: { sendMail: vi.fn().mockResolvedValue({}) },
}));
vi.mock("../../utils/publishEvent.js", () => ({ publishEvent: vi.fn() }));
vi.mock("../../utils/companyVerification.js", () => ({
  scheduleHybridCompanyVerification: vi.fn(),
}));

import { createApp } from "../../app.js";

const baseUser = {
  _id: "user-1",
  email: "john@example.com",
  firstName: "John",
  lastName: "Doe",
  accountStatus: "active",
  emailVerified: true,
  accountType: "jobseeker",
  tokenVersion: 0,
  comparePassword: vi.fn(),
  save: vi.fn().mockResolvedValue(undefined),
};

describe("POST /api/auth/login", () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
  });

  it("returns 400 when email or password is missing", async () => {
    const response = await request(app).post("/api/auth/login").send({ email: "john@example.com" });
    expect(response.status).toBe(400);
  });

  it("returns 401 for unknown users", async () => {
    mockFindOne.mockReturnValue({
      select: vi.fn().mockResolvedValue(null),
    });

    const response = await request(app).post("/api/auth/login").send({
      email: "missing@example.com",
      password: "Secure1!",
    });

    expect(response.status).toBe(401);
  });

  it("returns 403 when email is not verified", async () => {
    mockFindOne.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        ...baseUser,
        emailVerified: false,
      }),
    });

    const response = await request(app).post("/api/auth/login").send({
      email: "john@example.com",
      password: "Secure1!",
    });

    expect(response.status).toBe(403);
    expect(response.body.requiresEmailVerification).toBe(true);
  });

  it("returns 401 for invalid passwords", async () => {
    const user = {
      ...baseUser,
      comparePassword: vi.fn().mockResolvedValue(false),
    };
    mockFindOne.mockReturnValue({
      select: vi.fn().mockResolvedValue(user),
    });

    const response = await request(app).post("/api/auth/login").send({
      email: "john@example.com",
      password: "WrongPass1!",
    });

    expect(response.status).toBe(401);
  });

  it("returns 200 with token for valid credentials", async () => {
    const user = {
      ...baseUser,
      comparePassword: vi.fn().mockResolvedValue(true),
    };
    mockFindOne.mockReturnValue({
      select: vi.fn().mockResolvedValue(user),
    });

    const response = await request(app).post("/api/auth/login").send({
      email: "john@example.com",
      password: "Secure1!",
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(typeof response.body.token).toBe("string");
    expect(response.body.user.email).toBe("john@example.com");
  });
});
