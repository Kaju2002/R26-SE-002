import mongoose from "mongoose";

const savedJobSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: [true, "User id is required"],
      index: true,
    },
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: [true, "Job id is required"],
      index: true,
    },
    savedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

savedJobSchema.index({ userId: 1, jobId: 1 }, { unique: true });

const SavedJob = mongoose.model("SavedJob", savedJobSchema);

export default SavedJob;
