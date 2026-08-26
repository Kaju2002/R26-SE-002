import mongoose from "mongoose";

const registrySignalSchema = new mongoose.Schema(
  {
    source: { type: String, required: true, trim: true },
    found: { type: Boolean, default: false },
    note: { type: String, default: null, trim: true },
  },
  { _id: false }
);

const verificationRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    companyName: { type: String, required: true, trim: true },
    registrationNumber: { type: String, default: "", trim: true },
    website: { type: String, default: null, trim: true },
    industry: { type: String, default: "", trim: true },
    address: { type: String, default: "", trim: true },
    submittedByName: { type: String, default: "", trim: true },
    submittedByEmail: { type: String, default: "", trim: true },
    riskScore: { type: Number, default: 0.5, min: 0, max: 1 },
    summary: { type: String, default: "", trim: true },
    registrySignals: { type: [registrySignalSchema], default: [] },
    decision: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    decisionSource: {
      type: String,
      enum: ["auto", "admin"],
      default: "admin",
    },
    reviewedAt: { type: Date, default: null },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    rejectionReason: { type: String, default: null, trim: true },
    predictSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

verificationRequestSchema.index({ decision: 1, createdAt: -1 });
verificationRequestSchema.index({ userId: 1, decision: 1 });

export default mongoose.model("VerificationRequest", verificationRequestSchema);
