import mongoose from "mongoose";

const STATUS_EMAIL_KINDS = ["offered", "hired"];

const applicationStatusEmailLogSchema = new mongoose.Schema(
  {
    applicationId: {
      type: String,
      required: true,
      index: true,
    },
    kind: {
      type: String,
      enum: STATUS_EMAIL_KINDS,
      required: true,
    },
    applicantEmail: {
      type: String,
      required: true,
      trim: true,
    },
    jobTitle: { type: String, trim: true, default: "" },
    companyName: { type: String, trim: true, default: "" },
    sourceEventId: { type: String, default: null },
    sentAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

applicationStatusEmailLogSchema.index({ applicationId: 1, kind: 1 }, { unique: true });

export { STATUS_EMAIL_KINDS };
export default mongoose.model(
  "ApplicationStatusEmailLog",
  applicationStatusEmailLogSchema
);
