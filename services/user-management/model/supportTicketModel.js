import mongoose from "mongoose";

const SUPPORT_STATUSES = ["open", "in_progress", "closed"];
const SUPPORT_PRIORITIES = ["low", "medium", "high"];
const SUPPORT_LINKED_TYPES = ["user", "job", "report", "none"];
const SUPPORT_MESSAGE_AUTHORS = ["user", "admin"];

const supportMessageSchema = new mongoose.Schema(
  {
    author: {
      type: String,
      enum: SUPPORT_MESSAGE_AUTHORS,
      required: true,
    },
    authorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    authorName: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true, maxlength: 8000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const supportTicketSchema = new mongoose.Schema(
  {
    ticketNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, trim: true, maxlength: 8000 },
    requesterUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    requesterName: { type: String, required: true, trim: true },
    requesterEmail: { type: String, required: true, trim: true, lowercase: true },
    status: {
      type: String,
      enum: SUPPORT_STATUSES,
      default: "open",
      index: true,
    },
    priority: {
      type: String,
      enum: SUPPORT_PRIORITIES,
      default: "medium",
      index: true,
    },
    assigneeUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    assigneeName: { type: String, default: null, trim: true },
    assigneeEmail: { type: String, default: null, trim: true, lowercase: true },
    linkedType: {
      type: String,
      enum: SUPPORT_LINKED_TYPES,
      default: "none",
    },
    linkedId: { type: String, default: null, trim: true },
    linkedLabel: { type: String, default: null, trim: true, maxlength: 300 },
    internalNote: { type: String, default: null, trim: true, maxlength: 4000 },
    messages: { type: [supportMessageSchema], default: [] },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

supportTicketSchema.index({ status: 1, updatedAt: -1 });
supportTicketSchema.index({ requesterUserId: 1, createdAt: -1 });
supportTicketSchema.index({ assigneeUserId: 1, status: 1 });

export {
  SUPPORT_LINKED_TYPES,
  SUPPORT_MESSAGE_AUTHORS,
  SUPPORT_PRIORITIES,
  SUPPORT_STATUSES,
};

export default mongoose.model("SupportTicket", supportTicketSchema);
