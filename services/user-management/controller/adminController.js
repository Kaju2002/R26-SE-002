import User from "../model/userModel.js";
import { loadAdminActor } from "../utils/adminActor.js";
import { writeAuditLogForActor } from "../utils/writeAuditLog.js";

const MANAGED_TYPES = new Set(["jobseeker", "recruiter", "company"]);
const EMPLOYER_TYPES = ["company", "recruiter"];
const MANAGED_STATUSES = new Set(["active", "suspended", "banned"]);

/** UI uses banned; older records may still be deleted. */
const toManagedStatus = (status) => {
  const value = String(status || "active").toLowerCase();
  if (value === "banned" || value === "deleted") return "banned";
  if (value === "suspended" || value === "inactive") return "suspended";
  return "active";
};

const mapManagedUser = (user) => {
  const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim();
  let organization = null;
  if (user.accountType === "company" || user.accountType === "recruiter") {
    organization =
      user.company?.name || user.headline || null;
  }

  return {
    id: String(user._id),
    fullName: fullName || user.email || "Unknown",
    email: user.email || "",
    accountType: user.accountType,
    accountStatus: toManagedStatus(user.accountStatus),
    emailVerified: Boolean(user.emailVerified),
    organization,
    location: user.location || null,
    avatarUrl:
      user.avatar ||
      (user.accountType === "company" || user.accountType === "recruiter"
        ? user.company?.logo || null
        : null) ||
      null,
    createdAt: user.createdAt
      ? new Date(user.createdAt).toISOString()
      : new Date().toISOString(),
    lastLoginAt: user.lastLoginAt
      ? new Date(user.lastLoginAt).toISOString()
      : null,
    headline: user.headline || null,
    companyWebsite: user.company?.website || null,
    companyVerified: Boolean(user.company?.isVerified),
  };
};

/**
 * GET /api/admin/users
 * Query: q, accountType, accountStatus, page, limit
 */
export const listManagedUsers = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const accountType = String(req.query.accountType || "").trim().toLowerCase();
    const accountStatus = String(req.query.accountStatus || "")
      .trim()
      .toLowerCase();
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);

    const filter = {
      accountType: { $in: Array.from(MANAGED_TYPES) },
    };

    if (accountType === "company") {
      // Admin UI "Employers" — company registration + legacy recruiter accounts.
      filter.accountType = { $in: EMPLOYER_TYPES };
    } else if (MANAGED_TYPES.has(accountType)) {
      filter.accountType = accountType;
    }

    if (accountStatus === "active") {
      filter.accountStatus = "active";
    } else if (accountStatus === "suspended") {
      filter.accountStatus = { $in: ["suspended", "inactive"] };
    } else if (accountStatus === "banned") {
      filter.accountStatus = { $in: ["banned", "deleted"] };
    }

    if (q) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      filter.$or = [
        { email: regex },
        { firstName: regex },
        { lastName: regex },
        { location: regex },
        { headline: regex },
        { "company.name": regex },
      ];
    }

    const [users, total, typeCounts, statusCounts] = await Promise.all([
      User.find(filter)
        .select(
          "firstName lastName email accountType accountStatus emailVerified location headline avatar company createdAt lastLoginAt"
        )
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
      User.aggregate([
        { $match: { accountType: { $in: Array.from(MANAGED_TYPES) } } },
        { $group: { _id: "$accountType", count: { $sum: 1 } } },
      ]),
      User.aggregate([
        { $match: { accountType: { $in: Array.from(MANAGED_TYPES) } } },
        {
          $group: {
            _id: {
              $switch: {
                branches: [
                  {
                    case: { $in: ["$accountStatus", ["banned", "deleted"]] },
                    then: "banned",
                  },
                  {
                    case: {
                      $in: ["$accountStatus", ["suspended", "inactive"]],
                    },
                    then: "suspended",
                  },
                ],
                default: "active",
              },
            },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const byType = { jobseeker: 0, recruiter: 0, company: 0 };
    for (const row of typeCounts) {
      if (byType[row._id] !== undefined) byType[row._id] = row.count;
    }

    const byStatus = { active: 0, suspended: 0, banned: 0 };
    for (const row of statusCounts) {
      if (byStatus[row._id] !== undefined) byStatus[row._id] = row.count;
    }

    const items = users.map(mapManagedUser);
    const totalManaged = byType.jobseeker + byType.recruiter + byType.company;
    const employerCount = byType.company + byType.recruiter;

    return res.status(200).json({
      success: true,
      message: "Users fetched",
      items,
      counts: {
        total: totalManaged,
        jobseeker: byType.jobseeker,
        company: employerCount,
        recruiter: byType.recruiter,
        ...byStatus,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    });
  } catch (error) {
    console.error("listManagedUsers error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load users",
      error: error.message,
    });
  }
};

/**
 * PATCH /api/admin/users/:userId/status
 * Body: { accountStatus: 'active' | 'suspended' | 'banned', reason?: string }
 */
export const updateManagedUserStatus = async (req, res) => {
  try {
    const userId = String(req.params.userId || "").trim();
    const accountStatus = String(req.body?.accountStatus || "")
      .trim()
      .toLowerCase();
    const reason = String(req.body?.reason || "").trim();

    if (!/^[a-fA-F0-9]{24}$/.test(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user id",
      });
    }

    if (!MANAGED_STATUSES.has(accountStatus)) {
      return res.status(400).json({
        success: false,
        message: "accountStatus must be active, suspended, or banned",
      });
    }

    if (String(userId) === String(req.userId)) {
      return res.status(400).json({
        success: false,
        message: "You cannot change your own account status",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!MANAGED_TYPES.has(user.accountType)) {
      return res.status(403).json({
        success: false,
        message: "Only jobseeker, recruiter, and company accounts can be managed here",
      });
    }

    const previousStatus = toManagedStatus(user.accountStatus);
    const targetLabel = `${user.accountType} · ${`${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email}`;

    user.accountStatus = accountStatus;
    // Invalidate existing sessions when locking the account.
    if (accountStatus === "suspended" || accountStatus === "banned") {
      user.tokenVersion = (user.tokenVersion || 0) + 1;
    }
    await user.save();

    const actor = await loadAdminActor(req.userId);
    if (actor && previousStatus !== accountStatus) {
      const action =
        accountStatus === "active"
          ? "user.restore"
          : accountStatus === "suspended"
            ? "user.suspend"
            : "user.ban";

      void writeAuditLogForActor(actor, {
        action,
        targetType: "user",
        targetId: String(user._id),
        targetLabel,
        summary:
          accountStatus === "active"
            ? `Restored ${targetLabel}`
            : accountStatus === "suspended"
              ? `Suspended ${targetLabel}`
              : `Banned ${targetLabel}`,
        before: { accountStatus: previousStatus },
        after: { accountStatus },
        note: reason || null,
      });
    }

    return res.status(200).json({
      success: true,
      message:
        accountStatus === "active"
          ? "User restored"
          : accountStatus === "suspended"
            ? "User suspended"
            : "User banned",
      item: mapManagedUser(user.toObject()),
      reason: reason || null,
    });
  } catch (error) {
    console.error("updateManagedUserStatus error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not update user status",
      error: error.message,
    });
  }
};
