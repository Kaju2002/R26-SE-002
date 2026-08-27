import mongoose from "mongoose";

const MESSAGE_TYPES = ["text", "image", "file", "audio", "system"];
const MESSAGE_STATUSES = ["sent", "delivered", "read"];
const SCAM_CHECK_STATUSES = ["not_checked", "pending", "safe", "flagged", "error"];

const attachmentSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: [true, "Attachment URL is required"],
      trim: true,
    },
    publicId: {
      type: String,
      default: null,
      trim: true,
    },
    fileName: {
      type: String,
      required: [true, "Attachment file name is required"],
      trim: true,
      maxlength: 255,
    },
    mimeType: {
      type: String,
      required: [true, "Attachment MIME type is required"],
      trim: true,
    },
    size: {
      type: Number,
      default: 0,
      min: 0,
    },
    durationMs: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const scamAnalysisSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: SCAM_CHECK_STATUSES,
      default: "not_checked",
    },
    isScam: {
      type: Boolean,
      default: false,
    },
    score: {
      type: Number,
      default: null,
      min: 0,
      max: 1,
    },
    tactics: {
      type: [String],
      default: [],
    },
    analyzedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: [true, "Conversation id is required"],
    },
    // senderId comes from the verified JWT, never directly from client input.
    senderId: {
      type: String,
      required: [true, "Sender user id is required"],
      trim: true,
    },
    messageType: {
      type: String,
      enum: MESSAGE_TYPES,
      default: "text",
    },
    body: {
      type: String,
      default: "",
      trim: true,
      maxlength: [5000, "Message cannot exceed 5000 characters"],
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
    },
    status: {
      type: String,
      enum: MESSAGE_STATUSES,
      default: "sent",
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    readAt: {
      type: Date,
      default: null,
    },
    scamAnalysis: {
      type: scamAnalysisSchema,
      default: () => ({}),
    },
    /** User ids who hid this message for themselves only (Delete for me). */
    deletedFor: {
      type: [String],
      default: [],
    },
    /** Sender removed the message for both participants (Delete for everyone). */
    deletedForEveryone: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: String,
      default: null,
      trim: true,
    },
    /**
     * When true, this outgoing message was kept only for the sender because
     * the peer blocked them (silent undelivered / single-tick style).
     */
    suppressedForPeer: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

messageSchema.pre("validate", function () {
  // Tombstone messages from delete-for-everyone may keep a placeholder body.
  if (this.deletedForEveryone) return;

  const hasBody = Boolean(this.body?.trim());
  const hasAttachments = this.attachments?.length > 0;

  if (!hasBody && !hasAttachments) {
    throw new Error("A message must contain text or an attachment");
  }
});

messageSchema.index({ conversationId: 1, createdAt: 1 });
messageSchema.index({ senderId: 1, createdAt: -1 });
messageSchema.index({ "scamAnalysis.status": 1, createdAt: -1 });
messageSchema.index({ conversationId: 1, deletedFor: 1 });

const Message = mongoose.model("Message", messageSchema);

export default Message;
export { MESSAGE_TYPES, MESSAGE_STATUSES, SCAM_CHECK_STATUSES };
