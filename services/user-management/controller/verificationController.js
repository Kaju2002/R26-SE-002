import VerificationRequest from "../model/verificationRequestModel.js";
import User from "../model/userModel.js";
import {
  runHybridCompanyVerification,
  scheduleHybridCompanyVerification,
} from "../utils/companyVerification.js";

const mapRequest = (doc) => {
  const item = doc?.toObject ? doc.toObject() : doc;
  return {
    id: String(item._id),
    userId: item.userId ? String(item.userId) : null,
    companyName: item.companyName || "",
    registrationNumber: item.registrationNumber || "",
    website: item.website || null,
    industry: item.industry || "",
    address: item.address || "",
    submittedByName: item.submittedByName || "",
    submittedByEmail: item.submittedByEmail || "",
    submittedAt: item.createdAt
      ? new Date(item.createdAt).toISOString()
      : new Date().toISOString(),
    riskScore:
      typeof item.riskScore === "number" && Number.isFinite(item.riskScore)
        ? item.riskScore
        : 0.5,
    summary: item.summary || "",
    registrySignals: Array.isArray(item.registrySignals)
      ? item.registrySignals.map((s) => ({
          source: s.source || "Registry",
          found: Boolean(s.found),
          note: s.note || undefined,
        }))
      : [],
    decision: item.decision || "pending",
    decisionSource: item.decisionSource || "admin",
    reviewedAt: item.reviewedAt
      ? new Date(item.reviewedAt).toISOString()
      : null,
    rejectionReason: item.rejectionReason || null,
  };
};

/**
 * GET /api/admin/verification-requests
 * Query: q, decision, page, limit
 */
export const listVerificationRequests = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const decision = String(req.query.decision || "").trim().toLowerCase();
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);

    const filter = {};
    if (["pending", "approved", "rejected"].includes(decision)) {
      filter.decision = decision;
    }

    if (q) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      filter.$or = [
        { companyName: regex },
        { registrationNumber: regex },
        { submittedByName: regex },
        { submittedByEmail: regex },
        { industry: regex },
        { address: regex },
        { website: regex },
      ];
    }

    const [items, total, decisionCounts] = await Promise.all([
      VerificationRequest.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      VerificationRequest.countDocuments(filter),
      VerificationRequest.aggregate([
        { $group: { _id: "$decision", count: { $sum: 1 } } },
      ]),
    ]);

    const counts = { total: 0, pending: 0, approved: 0, rejected: 0 };
    for (const row of decisionCounts) {
      if (counts[row._id] !== undefined) counts[row._id] = row.count;
    }
    counts.total = counts.pending + counts.approved + counts.rejected;

    return res.status(200).json({
      success: true,
      message: "Verification requests fetched",
      items: items.map(mapRequest),
      counts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    });
  } catch (error) {
    console.error("listVerificationRequests error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load verification requests",
      error: error.message,
    });
  }
};

/**
 * PATCH /api/admin/verification-requests/:id/decision
 * Body: { decision: 'approved' | 'rejected', rejectionReason?: string }
 */
export const decideVerificationRequest = async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    const decision = String(req.body?.decision || "").trim().toLowerCase();
    const rejectionReason = String(req.body?.rejectionReason || "").trim();

    if (!/^[a-fA-F0-9]{24}$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request id",
      });
    }

    if (!["approved", "rejected"].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: "decision must be approved or rejected",
      });
    }

    if (decision === "rejected" && !rejectionReason) {
      return res.status(400).json({
        success: false,
        message: "rejectionReason is required when rejecting",
      });
    }

    const request = await VerificationRequest.findById(id);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Verification request not found",
      });
    }

    if (request.decision !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Request is already ${request.decision}`,
      });
    }

    request.decision = decision;
    request.decisionSource = "admin";
    request.reviewedAt = new Date();
    request.reviewedBy = req.userId || null;
    request.rejectionReason = decision === "rejected" ? rejectionReason : null;
    await request.save();

    const companyUser = await User.findById(request.userId);
    if (companyUser) {
      if (!companyUser.company) {
        companyUser.company = { name: request.companyName };
      }
      companyUser.company.isVerified = decision === "approved";
      await companyUser.save();
    }

    return res.status(200).json({
      success: true,
      message:
        decision === "approved"
          ? "Company verified"
          : "Verification request rejected",
      item: mapRequest(request),
    });
  } catch (error) {
    console.error("decideVerificationRequest error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not update verification decision",
      error: error.message,
    });
  }
};

/**
 * GET /api/profile/verification
 * Current company verification status for the logged-in employer.
 */
export const getMyVerificationStatus = async (req, res) => {
  try {
    const user = await User.findById(req.userId).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const latest = await VerificationRequest.findOne({ userId: user._id })
      .sort({ createdAt: -1 })
      .lean();

    const pending = await VerificationRequest.findOne({
      userId: user._id,
      decision: "pending",
    }).lean();

    return res.status(200).json({
      success: true,
      isVerified: Boolean(user.company?.isVerified),
      status: user.company?.isVerified
        ? "verified"
        : pending
          ? "pending"
          : latest?.decision === "rejected"
            ? "rejected"
            : "none",
      latest: latest ? mapRequest(latest) : null,
    });
  } catch (error) {
    console.error("getMyVerificationStatus error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load verification status",
      error: error.message,
    });
  }
};

/**
 * POST /api/profile/verification/request
 * Trigger hybrid re-check (force refresh).
 */
export const requestCompanyVerification = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!["company", "recruiter"].includes(user.accountType)) {
      return res.status(403).json({
        success: false,
        message: "Only company or recruiter accounts can request verification",
      });
    }

    const companyName = String(user.company?.name || "").trim();
    if (companyName.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Add a company name before requesting verification",
      });
    }

    // Respond quickly; heavy /predict runs in background unless client wants sync
    const sync = String(req.query.sync || req.body?.sync || "") === "1";
    if (sync) {
      const item = await runHybridCompanyVerification(user._id, { force: true });
      const refreshed = await User.findById(user._id).lean();
      return res.status(200).json({
        success: true,
        message: refreshed?.company?.isVerified
          ? "Company auto-verified"
          : "Verification submitted for review",
        isVerified: Boolean(refreshed?.company?.isVerified),
        item: item ? mapRequest(item) : null,
      });
    }

    scheduleHybridCompanyVerification(user._id, { force: true });
    return res.status(202).json({
      success: true,
      message: "Verification check started. Status will update shortly.",
      isVerified: Boolean(user.company?.isVerified),
    });
  } catch (error) {
    console.error("requestCompanyVerification error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not start verification",
      error: error.message,
    });
  }
};
