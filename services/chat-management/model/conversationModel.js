import mongoose from "mongoose";

const CONVERSATION_STATUSES = ["active", "archived", "blocked"];

const lastMessageSchema = new mongoose.Schema(
  {
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    senderId: {
      type: String,
      default: null,
      trim: true,
    },
    preview: {
      type: String,
      default: "",
      trim: true,
      maxlength: 160,
    },
    messageType: {
      type: String,
      enum: ["text", "image", "file", "system"],
      default: "text",
    },
    sentAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const unreadCountsSchema = new mongoose.Schema(
  {
    recruiter: {
      type: Number,
      default: 0,
      min: 0,
    },
    jobseeker: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const conversationSchema = new mongoose.Schema(
  {
    // IDs belong to other microservices, so they are stored as strings.
    recruiterId: {
      type: String,
      required: [true, "Recruiter user id is required"],
      trim: true,
    },
    jobseekerId: {
      type: String,
      required: [true, "Jobseeker user id is required"],
      trim: true,
    },
    applicationId: {
      type: String,
      required: [true, "Application id is required"],
      trim: true,
    },
    jobId: {
      type: String,
      required: [true, "Job id is required"],
      trim: true,
    },
    status: {
      type: String,
      enum: CONVERSATION_STATUSES,
      default: "active",
    },
    startedBy: {
      type: String,
      enum: ["recruiter", "jobseeker", "system"],
      default: "recruiter",
    },
    lastMessage: {
      type: lastMessageSchema,
      default: () => ({}),
    },
    unreadCounts: {
      type: unreadCountsSchema,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

conversationSchema.path("jobseekerId").validate(function (jobseekerId) {
  return this.recruiterId !== jobseekerId;
}, "Recruiter and jobseeker must be different users");

// One chat per job application prevents duplicate conversation threads.
conversationSchema.index({ applicationId: 1 }, { unique: true });
conversationSchema.index({ recruiterId: 1, updatedAt: -1 });
conversationSchema.index({ jobseekerId: 1, updatedAt: -1 });
conversationSchema.index({ jobId: 1 });

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;
export { CONVERSATION_STATUSES };
