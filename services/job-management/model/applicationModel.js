import mongoose from "mongoose";

const APPLICATION_STATUSES = ["sent", "pending", "accepted", "rejected"];

const applicationSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: [true, "Job id is required"],
      index: true,
    },
    workspaceId: {
      type: String,
      default: null,
      index: true,
    },
    applicantId: {
      type: String,
      required: [true, "Applicant user id is required"],
      index: true,
    },
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
    },
    resumeUrl: {
      type: String,
      default: null,
      trim: true,
    },
    resumeName: {
      type: String,
      default: "",
      trim: true,
    },
    motivation: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: APPLICATION_STATUSES,
      default: "sent",
      index: true,
    },
    appliedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

applicationSchema.index({ jobId: 1, applicantId: 1 }, { unique: true });

const Application = mongoose.model("Application", applicationSchema);

export default Application;
export { APPLICATION_STATUSES };
