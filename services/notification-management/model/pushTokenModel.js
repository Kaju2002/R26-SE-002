import mongoose from "mongoose";

const pushTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: [true, "User id is required"],
      index: true,
    },
    token: {
      type: String,
      required: [true, "Push token is required"],
      trim: true,
    },
    platform: {
      type: String,
      enum: ["ios", "android", "web", "unknown"],
      default: "unknown",
    },
    deviceName: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

pushTokenSchema.index({ token: 1 }, { unique: true });
pushTokenSchema.index({ userId: 1, updatedAt: -1 });

const PushToken = mongoose.model("PushToken", pushTokenSchema);

export default PushToken;
