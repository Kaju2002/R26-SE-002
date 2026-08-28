import mongoose from "mongoose";

const AUDIT_TARGET_TYPES = ["user", "company", "job", "report", "support"];

const AUDIT_ACTIONS = [
  "user.suspend",
  "user.ban",
  "user.restore",
  "company.verify.approve",
  "company.verify.reject",
  "job.clear",
  "job.force_close",
  "report.resolve",
  "report.dismiss",
  "support.ticket.assign",
  "support.ticket.reply",
  "support.ticket.close",
  "support.ticket.reopen",
];

const auditLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    actorName: { type: String, required: true, trim: true },
    actorEmail: { type: String, required: true, trim: true, lowercase: true },
    action: {
      type: String,
      enum: AUDIT_ACTIONS,
      required: true,
      index: true,
    },
    targetType: {
      type: String,
      enum: AUDIT_TARGET_TYPES,
      required: true,
      index: true,
    },
    targetId: { type: String, required: true, trim: true, index: true },
    targetLabel: { type: String, required: true, trim: true, maxlength: 300 },
    summary: { type: String, required: true, trim: true, maxlength: 500 },
    before: { type: mongoose.Schema.Types.Mixed, default: {} },
    after: { type: mongoose.Schema.Types.Mixed, default: {} },
    note: { type: String, default: null, trim: true, maxlength: 2000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ targetType: 1, createdAt: -1 });

export { AUDIT_ACTIONS, AUDIT_TARGET_TYPES };

export default mongoose.model("AuditLog", auditLogSchema);
