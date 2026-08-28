import AuditLog, { AUDIT_ACTIONS, AUDIT_TARGET_TYPES } from "../model/auditLogModel.js";
import { writeAuditLog } from "../utils/writeAuditLog.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toIso = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

export const mapAuditLog = (doc) => {
  const item = doc?.toObject ? doc.toObject() : doc;
  return {
    id: String(item._id),
    createdAt: toIso(item.createdAt) || new Date().toISOString(),
    actorId: item.actorId ? String(item.actorId) : "",
    actorName: item.actorName || "",
    actorEmail: item.actorEmail || "",
    action: item.action,
    targetType: item.targetType,
    targetId: item.targetId || "",
    targetLabel: item.targetLabel || "",
    summary: item.summary || "",
    before: item.before || {},
    after: item.after || {},
    note: item.note || null,
  };
};

/**
 * GET /api/admin/audit-log
 * Query: action, targetType, q, page, limit
 */
export const listAuditLogs = async (req, res) => {
  try {
    const action = String(req.query.action || "").trim();
    const targetType = String(req.query.targetType || "").trim();
    const q = String(req.query.q || "").trim();
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);

    const filter = {};

    if (AUDIT_ACTIONS.includes(action)) {
      filter.action = action;
    }

    if (AUDIT_TARGET_TYPES.includes(targetType)) {
      filter.targetType = targetType;
    }

    if (q) {
      const regex = new RegExp(escapeRegex(q), "i");
      filter.$or = [
        { actorName: regex },
        { actorEmail: regex },
        { action: regex },
        { targetLabel: regex },
        { targetId: regex },
        { summary: regex },
        { note: regex },
      ];
    }

    const [items, total, targetCounts] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter),
      AuditLog.aggregate([
        { $group: { _id: "$targetType", count: { $sum: 1 } } },
      ]),
    ]);

    const counts = {
      total: 0,
      user: 0,
      company: 0,
      job: 0,
      report: 0,
      support: 0,
    };

    for (const row of targetCounts) {
      if (counts[row._id] !== undefined) {
        counts[row._id] = row.count;
      }
    }
    counts.total =
      counts.user +
      counts.company +
      counts.job +
      counts.report +
      counts.support;

    return res.status(200).json({
      success: true,
      message: "Audit log fetched",
      items: items.map(mapAuditLog),
      counts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    });
  } catch (error) {
    console.error("listAuditLogs error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load audit log",
      error: error.message,
    });
  }
};

/**
 * POST /api/internal/audit-log
 * Body: actorId, actorName, actorEmail, action, targetType, targetId, targetLabel, summary, before?, after?, note?
 */
export const createAuditLogInternal = async (req, res) => {
  try {
    const expected = process.env.INTERNAL_SERVICE_KEY?.trim();
    const provided = String(req.headers["x-internal-service-key"] || "").trim();
    if (!expected || provided !== expected) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized internal request",
      });
    }

    const body = req.body || {};
    const created = await writeAuditLog({
      actorId: body.actorId,
      actorName: body.actorName,
      actorEmail: body.actorEmail,
      action: body.action,
      targetType: body.targetType,
      targetId: body.targetId,
      targetLabel: body.targetLabel,
      summary: body.summary,
      before: body.before,
      after: body.after,
      note: body.note,
    });

    if (!created) {
      return res.status(400).json({
        success: false,
        message: "Could not create audit log entry",
      });
    }

    return res.status(201).json({
      success: true,
      message: "Audit log entry created",
      item: mapAuditLog(created),
    });
  } catch (error) {
    console.error("createAuditLogInternal error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not create audit log entry",
      error: error.message,
    });
  }
};
