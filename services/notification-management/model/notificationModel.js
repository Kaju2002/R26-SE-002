import mongoose from "mongoose";

const NOTIFICATION_CATEGORIES = ["general", "applications"];
const NOTIFICATION_TYPES = ["auth", "scam", "job", "application", "system"];
const APPLICATION_STATUSES = ["sent", "pending", "accepted", "rejected"];

const metadataSchema = new mongoose.Schema(
  {
    applicationId: { type: String, trim: true },
    jobId: { type: String, trim: true },
    jobTitle: { type: String, trim: true, default: "" },
    companyName: { type: String, trim: true, default: "" },
    companyLogo: { type: String, default: null },
    applicationStatus: {
      type: String,
      enum: APPLICATION_STATUSES,
    },
  },
  { _id: false }
);

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: [true, "User id is required"],
      index: true,
    },
    category: {
      type: String,
      enum: NOTIFICATION_CATEGORIES,
      required: [true, "Category is required"],
      index: true,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: [true, "Type is required"],
      index: true,
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },
    body: {
      type: String,
      required: [true, "Body is required"],
      trim: true,
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    metadata: {
      type: metadataSchema,
      default: undefined,
    },
    sourceEventId: {
      type: String,
      trim: true,
      index: true,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index(
  { userId: 1, "metadata.applicationId": 1 },
  {
    unique: true,
    partialFilterExpression: {
      category: "applications",
      "metadata.applicationId": { $type: "string" },
    },
  }
);
notificationSchema.index(
  { sourceEventId: 1 },
  {
    unique: true,
    partialFilterExpression: { sourceEventId: { $type: "string" } },
  }
);

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
export {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_TYPES,
  APPLICATION_STATUSES,
};
