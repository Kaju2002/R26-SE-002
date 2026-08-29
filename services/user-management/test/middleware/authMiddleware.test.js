import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authMiddleware, requireSuperAdmin } from "../../middleware/authMiddleware.js";

const { mockFindById } = vi.hoisted(() => ({
  mockFindById: vi.fn(),
}));

vi.mock("../../model/userModel.js", () => ({
  default: {
    findById: (...args) => mockFindById(...args),
  },
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
    process.env.JWT_SECRET = "test-secret";
  });

  it("returns 401 when no bearer token is provided", async () => {
    const req = { headers: {} };
    const res = createMockRes();
    const next = vi.fn();

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 for invalid tokens", async () => {
    const req = { headers: { authorization: "Bearer not-a-valid-token" } };
    const res = createMockRes();
    const next = vi.fn();

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 403 for suspended accounts", async () => {
    const token = jwt.sign(
      { userId: "user-1", email: "john@example.com", tokenVersion: 0 },
      "test-secret"
    );

    mockFindById.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        accountStatus: "suspended",
        tokenVersion: 0,
        email: "john@example.com",
      }),
    });

    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = createMockRes();
    const next = vi.fn();

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("calls next and attaches user context for valid sessions", async () => {
    const token = jwt.sign(
      { userId: "user-1", email: "john@example.com", tokenVersion: 1 },
      "test-secret"
    );

    mockFindById.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        accountStatus: "active",
        tokenVersion: 1,
        email: "john@example.com",
      }),
    });

    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = createMockRes();
    const next = vi.fn();

    await authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.userId).toBe("user-1");
    expect(req.email).toBe("john@example.com");
  });
});

describe("requireSuperAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 for non-admin users", async () => {
    mockFindById.mockReturnValue({
      select: vi.fn().mockResolvedValue({ accountType: "recruiter" }),
    });

    const req = { userId: "user-1" };
    const res = createMockRes();
    const next = vi.fn();

    await requireSuperAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("allows superadmin users through", async () => {
    mockFindById.mockReturnValue({
      select: vi.fn().mockResolvedValue({ accountType: "superadmin" }),
    });

    const req = { userId: "admin-1" };
    const res = createMockRes();
    const next = vi.fn();

    await requireSuperAdmin(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
