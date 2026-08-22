import mongoose from "mongoose";

export const TEMPLATE_CATEGORIES = [
  "screening",
  "interview_invite",
  "reject",
  "offer",
  "custom",
];

const messageTemplateSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: String,
      default: null,
      index: true,
    },
    ownerId: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    category: {
      type: String,
      enum: TEMPLATE_CATEGORIES,
      default: "custom",
      index: true,
    },
    subject: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 10000,
    },
  },
  { timestamps: true }
);

messageTemplateSchema.index({ ownerId: 1, updatedAt: -1 });
messageTemplateSchema.index({ workspaceId: 1, updatedAt: -1 });

const MessageTemplate = mongoose.model("MessageTemplate", messageTemplateSchema);
export default MessageTemplate;
