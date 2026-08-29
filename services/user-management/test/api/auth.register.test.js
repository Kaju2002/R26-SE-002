import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const { mockFindOne, mockCreate, mockSendMail } = vi.hoisted(() => ({
  mockFindOne: vi.fn(),
  mockCreate: vi.fn(),
  mockSendMail: vi.fn(),
}));

vi.mock("../../config/mongodb.js", () => ({ default: vi.fn() }));
vi.mock("../../model/userModel.js", () => ({
  default: {
    findOne: (...args) => mockFindOne(...args),
    create: (...args) => mockCreate(...args),
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

describe("POST /api/auth/register", () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSendMail.mockResolvedValue({});
  });

  it("returns 400 when required fields are missing", async () => {
    const response = await request(app).post("/api/auth/register").send({});

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("returns 400 for weak passwords", async () => {
    const response = await request(app).post("/api/auth/register").send({
      fullName: "John Doe",
      email: "john@example.com",
      password: "weak",
      confirmPassword: "weak",
    });

    expect(response.status).toBe(400);
  });

  it("returns 409 when email is already registered", async () => {
    mockFindOne.mockResolvedValue({ email: "john@example.com" });

    const response = await request(app).post("/api/auth/register").send({
      fullName: "John Doe",
      email: "john@example.com",
      password: "Secure1!",
      confirmPassword: "Secure1!",
    });

    expect(response.status).toBe(409);
    expect(response.body.message).toMatch(/already registered/i);
  });

  it("returns 201 and sends verification email on success", async () => {
    mockFindOne.mockResolvedValue(null);
    mockCreate.mockResolvedValue({
      _id: "user-1",
      email: "john@example.com",
      firstName: "John",
      lastName: "Doe",
      createdAt: new Date("2026-08-29T09:00:00.000Z"),
    });

    const response = await request(app).post("/api/auth/register").send({
      fullName: "John Doe",
      email: "john@example.com",
      password: "Secure1!",
      confirmPassword: "Secure1!",
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.requiresEmailVerification).toBe(true);
    expect(mockSendMail).toHaveBeenCalledTimes(1);
  });
});
