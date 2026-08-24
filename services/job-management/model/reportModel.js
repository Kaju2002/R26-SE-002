import mongoose from "mongoose";

const REASON_CODES = [
  "fake_job",
  "payment_request",
  "harassment",
  "spam",
  "impersonation",
  "other",
];

const REPORT_STATUSES = ["new", "reviewing", "resolved", "dismissed"];

const reportSchema = new mongoose.Schema(
  {
    targetType: {
      type: String,
      enum: ["job"],
      default: "job",
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
      index: true,
    },
    targetLabel: {
      type: String,
      trim: true,
      default: "",
    },
    reporterId: {
      type: String,
      required: true,
      index: true,
    },
    reporterName: {
      type: String,
      trim: true,
      default: "",
    },
    reporterEmail: {
      type: String,
      trim: true,
      default: "",
    },
    reasonCode: {
      type: String,
      enum: REASON_CODES,
      required: true,
    },
    details: {
      type: String,
      trim: true,
      default: "",
      maxlength: [2000, "Details must be at most 2000 characters"],
    },
    status: {
      type: String,
      enum: REPORT_STATUSES,
      default: "new",
      index: true,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    adminNote: {
      type: String,
      trim: true,
      default: "",
    },
    moderatedBy: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

/** One open report per user + job (resolved/dismissed allow a new one). */
reportSchema.index(
  { reporterId: 1, targetId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ["new", "reviewing"] } },
  }
);

export const REPORT_REASON_CODES = REASON_CODES;
export const REPORT_STATUS_VALUES = REPORT_STATUSES;

const Report = mongoose.model("Report", reportSchema);

export default Report;
