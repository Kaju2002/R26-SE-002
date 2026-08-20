import mongoose from "mongoose";

const applicationEmailLogSchema = new mongoose.Schema(
  {
    applicationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
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

export default mongoose.model("ApplicationEmailLog", applicationEmailLogSchema);
