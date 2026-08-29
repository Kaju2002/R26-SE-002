import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  authMiddleware,
  optionalAuthMiddleware,
  requireSuperAdmin,
} from "../../middleware/authMiddleware.js";

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

describe("authMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no bearer token is provided", async () => {
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

  it("returns upstream auth status when session validation fails", async () => {
    mockValidateUserSession.mockResolvedValue({
      ok: false,
      status: 403,
      message: "Account suspended",
    });

    const req = { headers: { authorization: "Bearer bad-token" } };
    const res = createMockRes();
    const next = vi.fn();

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Account suspended",
    });
  });

  it("calls next and attaches user context for valid sessions", async () => {
    mockValidateUserSession.mockResolvedValue({
      ok: true,
      user: {
        id: "recruiter-1",
        email: "recruiter@example.com",
        accountType: "recruiter",
      },
    });

    const req = { headers: { authorization: "Bearer valid-token" } };
    const res = createMockRes();
    const next = vi.fn();

    await authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.userId).toBe("recruiter-1");
    expect(req.userEmail).toBe("recruiter@example.com");
    expect(req.user.accountType).toBe("recruiter");
  });
});

describe("optionalAuthMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("continues without auth when bearer token is missing", async () => {
    const req = { headers: {} };
    const res = createMockRes();
    const next = vi.fn();

    await optionalAuthMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.userId).toBeUndefined();
    expect(mockValidateUserSession).not.toHaveBeenCalled();
  });

  it("attaches user when bearer token is valid", async () => {
    mockValidateUserSession.mockResolvedValue({
      ok: true,
      user: { id: "user-1", email: "user@example.com" },
    });

    const req = { headers: { authorization: "Bearer valid-token" } };
    const res = createMockRes();
    const next = vi.fn();

    await optionalAuthMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.userId).toBe("user-1");
  });
});

describe("requireSuperAdmin", () => {
  it("returns 403 for non-admin users", () => {
    const req = { user: { accountType: "recruiter" } };
    const res = createMockRes();
    const next = vi.fn();

    requireSuperAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("allows superadmin users through", () => {
    const req = { user: { accountType: "superadmin" } };
    const res = createMockRes();
    const next = vi.fn();

    requireSuperAdmin(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
