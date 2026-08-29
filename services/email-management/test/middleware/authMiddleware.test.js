import { beforeEach, describe, expect, it, vi } from "vitest";
import { authMiddleware } from "../../middleware/authMiddleware.js";

const { mockValidateUserSession } = vi.hoisted(() => ({
  mockValidateUserSession: vi.fn(),
}));

vi.mock("../../config/userManagementClient.js", () => ({
  validateUserSession: (...args) => mockValidateUserSession(...args),
}));

const createMockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe("email authMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when session validation fails", async () => {
    mockValidateUserSession.mockResolvedValue({
      ok: false,
      status: 401,
      message: "No token provided. Please login.",
    });

    const req = { headers: {} };
    const res = createMockRes();
    const next = vi.fn();

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 for jobseeker accounts", async () => {
    mockValidateUserSession.mockResolvedValue({
      ok: true,
      user: {
        id: "seeker-1",
        email: "seeker@example.com",
        accountType: "jobseeker",
      },
    });

    const req = { headers: { authorization: "Bearer token" } };
    const res = createMockRes();
    const next = vi.fn();

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Only recruiters and companies can use in-app email",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("allows recruiters and attaches user context", async () => {
    mockValidateUserSession.mockResolvedValue({
      ok: true,
      user: {
        id: "recruiter-1",
        email: "hr@acme.com",
        accountType: "recruiter",
      },
    });

    const req = { headers: { authorization: "Bearer valid-token" } };
    const res = createMockRes();
    const next = vi.fn();

    await authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.userId).toBe("recruiter-1");
    expect(req.userEmail).toBe("hr@acme.com");
    expect(req.authorizationHeader).toBe("Bearer valid-token");
  });

  it("allows company accounts", async () => {
    mockValidateUserSession.mockResolvedValue({
      ok: true,
      user: {
        id: "company-1",
        email: "ops@company.com",
        accountType: "company",
      },
    });

    const req = { headers: { authorization: "Bearer company-token" } };
    const res = createMockRes();
    const next = vi.fn();

    await authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user.accountType).toBe("company");
  });
});
