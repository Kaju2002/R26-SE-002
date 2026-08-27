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
const FEEDBACK_VALUES = ["none", "helpful", "false_alarm"];

const evidenceMessageSchema = new mongoose.Schema(
  {
    messageId: { type: String, required: true },
    senderId: { type: String, default: "" },
    role: { type: String, enum: ["recruiter", "jobseeker", "unknown"], default: "unknown" },
    messageType: {
      type: String,
      enum: ["text", "image", "file", "audio", "system"],
      default: "text",
    },
    body: { type: String, default: "" },
    createdAt: { type: Date, default: null },
    scamAnalysis: {
      status: { type: String, default: "not_checked" },
      isScam: { type: Boolean, default: false },
      score: { type: Number, default: null },
      tactics: { type: [String], default: [] },
      analyzedAt: { type: Date, default: null },
    },
  },
  { _id: false }
);

const timelinePointSchema = new mongoose.Schema(
  {
    at: { type: Date, required: true },
    label: { type: String, required: true },
    riskLevel: {
      type: String,
      enum: ["safe", "caution", "high"],
      default: "caution",
    },
    messageId: { type: String, default: null },
    tactics: { type: [String], default: [] },
    score: { type: Number, default: null },
  },
  { _id: false }
);

const chatReportSchema = new mongoose.Schema(
  {
    conversationId: {
      type: String,
      required: true,
      index: true,
    },
    applicationId: { type: String, default: "", index: true },
    jobId: { type: String, default: "" },
    recruiterId: { type: String, default: "", index: true },
    jobseekerId: { type: String, default: "", index: true },
    workspaceName: { type: String, default: "" },
    peerLabel: { type: String, default: "" },
    jobLabel: { type: String, default: "" },

    reporterId: { type: String, required: true, index: true },
    reporterName: { type: String, default: "" },
    reporterEmail: { type: String, default: "" },
    reporterRole: {
      type: String,
      enum: ["jobseeker", "recruiter"],
      default: "jobseeker",
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
      maxlength: 2000,
    },

    evidenceMessages: { type: [evidenceMessageSchema], default: [] },
    timeline: { type: [timelinePointSchema], default: [] },
    tacticsSummary: { type: [String], default: [] },
    flaggedCount: { type: Number, default: 0 },
    maxScore: { type: Number, default: null },
    riskLevel: {
      type: String,
      enum: ["caution", "high"],
      default: "caution",
    },

    status: {
      type: String,
      enum: REPORT_STATUSES,
      default: "new",
      index: true,
    },
    resolvedAt: { type: Date, default: null },
    adminNote: { type: String, default: "" },
    moderatedBy: { type: String, default: null },

    /** Reporter feedback on whether the scam flag was useful. */
    feedback: {
      type: String,
      enum: FEEDBACK_VALUES,
      default: "none",
    },
    feedbackAt: { type: Date, default: null },
  },
  { timestamps: true }
);

chatReportSchema.index(
  { reporterId: 1, conversationId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ["new", "reviewing"] } },
  }
);

export const CHAT_REPORT_REASON_CODES = REASON_CODES;
export const CHAT_REPORT_STATUS_VALUES = REPORT_STATUSES;
export const CHAT_REPORT_FEEDBACK_VALUES = FEEDBACK_VALUES;

const ChatReport = mongoose.model("ChatReport", chatReportSchema);
export default ChatReport;
