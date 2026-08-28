import AuditLog, { AUDIT_ACTIONS, AUDIT_TARGET_TYPES } from "../model/auditLogModel.js";

const sanitizeRecord = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  return String(value);
};

const sanitizeSnapshot = (snapshot = {}) => {
  const output = {};
  for (const [key, value] of Object.entries(snapshot || {})) {
    output[key] = sanitizeRecord(value);
  }
  return output;
};

/**
 * Persist an immutable admin audit log entry.
 * Never throws — audit failures must not block admin actions.
 */
export const writeAuditLog = async ({
  actorId,
  actorName,
  actorEmail,
  action,
  targetType,
  targetId,
  targetLabel,
  summary,
  before = {},
  after = {},
  note = null,
}) => {
  try {
    if (!actorId || !action || !targetType || !targetId || !summary) {
      console.warn("writeAuditLog skipped: missing required fields");
      return null;
    }

    if (!AUDIT_ACTIONS.includes(action)) {
      console.warn(`writeAuditLog skipped: unknown action ${action}`);
      return null;
    }

    if (!AUDIT_TARGET_TYPES.includes(targetType)) {
      console.warn(`writeAuditLog skipped: unknown targetType ${targetType}`);
      return null;
    }

    return await AuditLog.create({
      actorId,
      actorName: String(actorName || "Admin").trim().slice(0, 120),
      actorEmail: String(actorEmail || "").trim().toLowerCase().slice(0, 200),
      action,
      targetType,
      targetId: String(targetId).trim().slice(0, 120),
      targetLabel: String(targetLabel || targetId).trim().slice(0, 300),
      summary: String(summary).trim().slice(0, 500),
      before: sanitizeSnapshot(before),
      after: sanitizeSnapshot(after),
      note: note ? String(note).trim().slice(0, 2000) : null,
    });
  } catch (error) {
    console.error("writeAuditLog error:", error);
    return null;
  }
};

export const writeAuditLogForActor = async (actor, entry) => {
  if (!actor?.userId) return null;
  return writeAuditLog({
    actorId: actor.userId,
    actorName: actor.name,
    actorEmail: actor.email,
    ...entry,
  });
};
