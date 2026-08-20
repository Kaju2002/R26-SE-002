import mongoose from "mongoose";
import Conversation from "../model/conversationModel.js";
import Message from "../model/messageModel.js";
import {
  emitConversationCleared,
  emitMessageDeleted,
  emitMessageStatus,
  emitNewMessage,
  isUserOnline,
} from "../config/socket.js";
import { analyzeMessageForScam } from "../utils/scamDetectionClient.js";
import { fetchApplication } from "../utils/jobManagementClient.js";
import { publishEvent } from "../utils/publishEvent.js";
import { EVENT_TYPES } from "../constants/eventTypes.js";
import {
  deleteUploadedAttachment,
  uploadChatDocument,
  uploadChatImage,
} from "../utils/chatImageUpload.js";
import {
  buildConversationEventContext,
  getAuthorizedConversation,
  getRequestWorkspaceId,
} from "../utils/workspaceAuthorization.js";

const DELETED_EVERYONE_PREVIEW = "This message was deleted";

const isValidObjectId = (id) => /^[a-fA-F0-9]{24}$/.test(String(id));

const parsePagination = (query) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 100);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

const formatMessage = (message) => {
  const deletedForEveryone = Boolean(message.deletedForEveryone);
  return {
    id: String(message._id),
    conversationId: String(message.conversationId),
    senderId: message.senderId,
    messageType: deletedForEveryone ? "system" : message.messageType,
    body: deletedForEveryone ? DELETED_EVERYONE_PREVIEW : message.body || "",
    attachments: deletedForEveryone ? [] : message.attachments || [],
    status: message.status,
    deliveredAt: message.deliveredAt,
    readAt: message.readAt,
    scamAnalysis: deletedForEveryone
      ? { status: "not_checked", isScam: false, score: null, tactics: [], analyzedAt: null }
      : message.scamAnalysis || { status: "not_checked", isScam: false },
    deletedForEveryone,
    deletedAt: message.deletedAt ?? null,
    deletedBy: message.deletedBy ?? null,
    suppressedForPeer: Boolean(message.suppressedForPeer),
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  };
};

/**
 * Load a conversation and ensure the caller is a participant.
 * Returns { ok, status?, message?, conversation? }.
 */
const getParticipantConversation = async (conversationId, req) =>
  getAuthorizedConversation({
    conversationId,
    userId: req.userId,
    accountType: req.accountType,
    workspaceId: getRequestWorkspaceId(req),
    authorizationHeader: req.headers.authorization,
    membershipCache: (req.workspaceMembershipCache ??= new Map()),
  });

/**
 * GET /api/chat/conversations/:conversationId/messages
 * Query: ?page=1&limit=50
 *
 * Returns messages for a conversation the caller belongs to.
 * Sorted oldest → newest (natural chat order).
 * Page 1 starts from the beginning of the thread.
 */
export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const access = await getParticipantConversation(conversationId, req);

    if (!access.ok) {
      return res.status(access.status).json({
        success: false,
        message: access.message,
      });
    }

    const { page, limit, skip } = parsePagination(req.query);
    // Peer must not see undelivered messages from someone they blocked.
    const filter = {
      conversationId: new mongoose.Types.ObjectId(conversationId),
      deletedFor: { $ne: String(req.userId) },
      $or: [
        { suppressedForPeer: { $ne: true } },
        { senderId: String(req.userId) },
      ],
    };

    const [messages, total] = await Promise.all([
      Message.find(filter).sort({ createdAt: 1 }).skip(skip).limit(limit),
      Message.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Messages fetched successfully",
      conversationId,
      workspaceId: access.conversation.workspaceId || null,
      messages: messages.map(formatMessage),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    });
  } catch (error) {
    console.error("Get messages error:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching messages",
      error: error.message,
    });
  }
};

const refreshConversationLastMessage = async (conversation) => {
  const latest = await Message.findOne({
    conversationId: conversation._id,
    deletedForEveryone: { $ne: true },
    suppressedForPeer: { $ne: true },
  }).sort({ createdAt: -1 });

  if (!latest) {
    await Conversation.findByIdAndUpdate(conversation._id, {
      $set: {
        lastMessage: {
          messageId: null,
          senderId: null,
          preview: "",
          messageType: "text",
          sentAt: null,
        },
      },
    });
    return;
  }

  const previewSource = latest.deletedForEveryone
    ? DELETED_EVERYONE_PREVIEW
    : latest.body ||
      (latest.messageType === "image"
        ? "📷 Photo"
        : latest.messageType === "file"
          ? `📎 ${latest.attachments?.[0]?.fileName || "Document"}`
          : "");
  const trimmed = String(previewSource).trim();
  const preview =
    trimmed.length > 160 ? `${trimmed.slice(0, 157)}...` : trimmed;

  await Conversation.findByIdAndUpdate(conversation._id, {
    $set: {
      lastMessage: {
        messageId: latest._id,
        senderId: latest.senderId,
        preview,
        messageType: latest.messageType || "text",
        sentAt: latest.createdAt,
      },
    },
  });
};

/**
 * DELETE /api/chat/conversations/:conversationId/messages/:messageId
 * Body/query: { mode: "me" | "everyone" }
 *
 * - me: hide message for the caller only (soft delete)
 * - everyone: sender tombstones the message for both participants
 */
export const deleteMessage = async (req, res) => {
  try {
    const { conversationId, messageId } = req.params;
    const mode = String(req.body?.mode || req.query?.mode || "")
      .trim()
      .toLowerCase();

    if (mode !== "me" && mode !== "everyone") {
      return res.status(400).json({
        success: false,
        message: 'mode is required and must be "me" or "everyone"',
      });
    }

    if (!isValidObjectId(messageId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid message id",
      });
    }

    const access = await getParticipantConversation(conversationId, req);
    if (!access.ok) {
      return res.status(access.status).json({
        success: false,
        message: access.message,
      });
    }

    const conversation = access.conversation;
    const eventConversation = buildConversationEventContext(
      conversation,
      access
    );
    const message = await Message.findOne({
      _id: messageId,
      conversationId: conversation._id,
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found in this conversation",
      });
    }

    // Already hidden for this user.
    if ((message.deletedFor || []).map(String).includes(String(req.userId))) {
      return res.status(200).json({
        success: true,
        message: "Message already deleted for you",
        mode: "me",
        conversationId,
        messageId: String(message._id),
      });
    }

    const now = new Date();

    if (mode === "me") {
      await Message.findByIdAndUpdate(message._id, {
        $addToSet: { deletedFor: String(req.userId) },
        $set: {
          deletedAt: message.deletedAt || now,
          deletedBy: message.deletedBy || String(req.userId),
        },
      });

      emitMessageDeleted(
        conversationId,
        {
          messageId: String(message._id),
          deletedBy: String(req.userId),
          deletedAt: now,
          workspaceId: conversation.workspaceId || null,
        },
        {
          mode: "me",
          userId: String(req.userId),
          conversation: eventConversation,
        }
      );

      return res.status(200).json({
        success: true,
        message: "Message deleted for you",
        mode: "me",
        conversationId,
        messageId: String(message._id),
      });
    }

    // mode === "everyone"
    if (String(message.senderId) !== String(req.userId)) {
      return res.status(403).json({
        success: false,
        message: "Only the sender can delete this message for everyone",
      });
    }

    if (message.deletedForEveryone) {
      return res.status(200).json({
        success: true,
        message: "Message already deleted for everyone",
        mode: "everyone",
        conversationId,
        chatMessage: formatMessage(message),
      });
    }

    message.deletedForEveryone = true;
    message.deletedAt = now;
    message.deletedBy = String(req.userId);
    message.body = DELETED_EVERYONE_PREVIEW;
    message.attachments = [];
    message.messageType = "system";
    message.scamAnalysis = {
      status: "not_checked",
      isScam: false,
      score: null,
      tactics: [],
      analyzedAt: null,
    };
    await message.save();

    const wasLastMessage =
      conversation.lastMessage?.messageId &&
      String(conversation.lastMessage.messageId) === String(message._id);

    if (wasLastMessage) {
      await Conversation.findByIdAndUpdate(conversation._id, {
        $set: {
          "lastMessage.preview": DELETED_EVERYONE_PREVIEW,
          "lastMessage.messageType": "system",
        },
      });
    } else {
      await refreshConversationLastMessage(conversation);
    }

    const chatMessage = formatMessage(message);
    emitMessageDeleted(
      conversationId,
      {
        messageId: String(message._id),
        deletedBy: String(req.userId),
        deletedAt: now,
        chatMessage,
      },
      {
        mode: "everyone",
        conversation: eventConversation,
      }
    );

    return res.status(200).json({
      success: true,
      message: "Message deleted for everyone",
      mode: "everyone",
      conversationId,
      chatMessage,
    });
  } catch (error) {
    console.error("Delete message error:", error);
    return res.status(500).json({
      success: false,
      message: "Error deleting message",
      error: error.message,
    });
  }
};

/**
 * POST /api/chat/conversations/:conversationId/clear
 *
 * WhatsApp-style "Clear chat" for the caller only:
 * - soft-hides all existing messages for this user (deletedFor)
 * - sets clearedAt for this participant (inbox preview)
 * - resets their unread count to 0
 * Peer conversation is unchanged.
 */
export const clearConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const access = await getParticipantConversation(conversationId, req);

    if (!access.ok) {
      return res.status(access.status).json({
        success: false,
        message: access.message,
      });
    }

    const conversation = access.conversation;
    const eventConversation = buildConversationEventContext(
      conversation,
      access
    );
    const isRecruiter = access.role === "recruiter";
    const clearedAtField = isRecruiter ? "clearedAt.recruiter" : "clearedAt.jobseeker";
    const unreadField = isRecruiter
      ? "unreadCounts.recruiter"
      : "unreadCounts.jobseeker";
    const now = new Date();
    const userId = String(req.userId);

    const updateResult = await Message.updateMany(
      {
        conversationId: conversation._id,
        deletedFor: { $ne: userId },
      },
      {
        $addToSet: { deletedFor: userId },
      }
    );

    await Conversation.findByIdAndUpdate(conversation._id, {
      $set: {
        [clearedAtField]: now,
        [unreadField]: 0,
      },
    });

    emitConversationCleared(conversationId, userId, {
      clearedBy: userId,
      clearedAt: now,
      clearedCount: updateResult.modifiedCount ?? 0,
      mode: "me",
      workspaceId: conversation.workspaceId || null,
    }, eventConversation);

    return res.status(200).json({
      success: true,
      message: "Conversation cleared for you",
      mode: "me",
      conversationId,
      clearedAt: now,
      clearedCount: updateResult.modifiedCount ?? 0,
      myUnread: 0,
    });
  } catch (error) {
    console.error("Clear conversation error:", error);
    return res.status(500).json({
      success: false,
      message: "Error clearing conversation",
      error: error.message,
    });
  }
};

const buildPreview = (body = "") => {
  const trimmed = String(body).trim();
  if (!trimmed) return "";
  return trimmed.length > 160 ? `${trimmed.slice(0, 157)}...` : trimmed;
};

const buildAttachmentPreview = (messageType, attachment) => {
  if (messageType === "image") return "📷 Photo";
  if (messageType === "file") {
    return `📎 ${attachment?.fileName || "Document"}`;
  }
  return "";
};

/**
 * POST /api/chat/conversations/:conversationId/messages
 * JSON body: { body: "Hello" }
 * Multipart body: image=<JPG|PNG|GIF|WebP> or
 * document=<PDF|DOC|DOCX>, body=<optional caption>
 *
 * Saves a text, image, or document message from the authenticated participant,
 * runs scam-detection for recruiter messages only (FraudAware),
 * updates lastMessage + unread, then broadcasts message:new over Socket.io.
 */
export const sendMessage = async (req, res) => {
  let uploadedAttachmentCommitted = false;
  let uploadedAttachmentPublicId = null;
  let uploadedAttachmentResourceType = "image";
  try {
    const { conversationId } = req.params;
    const access = await getParticipantConversation(conversationId, req);

    if (!access.ok) {
      return res.status(access.status).json({
        success: false,
        message: access.message,
      });
    }

    const conversation = access.conversation;
    const eventConversation = buildConversationEventContext(
      conversation,
      access
    );
    const blockedBy = conversation.blockedBy
      ? String(conversation.blockedBy)
      : null;
    const isBlocked = conversation.status === "blocked";
    // Legacy rows without blockedBy act as mutual block for both sides.
    const iAmBlocker =
      isBlocked && (!blockedBy || blockedBy === String(req.userId));
    const silentUndelivered =
      isBlocked && Boolean(blockedBy) && blockedBy !== String(req.userId);

    // Blocker cannot message until they unblock (WhatsApp-style).
    if (iAmBlocker) {
      return res.status(403).json({
        success: false,
        code: "BLOCKED_BY_YOU",
        message: "You blocked this conversation. Unblock to send messages.",
      });
    }

    const body = String(req.body?.body ?? "").trim();
    const imageFile = req.files?.image?.[0];
    const documentFile = req.files?.document?.[0];
    const hasImage = Boolean(imageFile);
    const hasDocument = Boolean(documentFile);
    const hasAttachment = hasImage || hasDocument;
    if (!body && !hasAttachment) {
      return res.status(400).json({
        success: false,
        message: "Message body or attachment is required",
      });
    }

    if (body.length > 5000) {
      return res.status(400).json({
        success: false,
        message: "Message cannot exceed 5000 characters",
      });
    }

    // FraudAware: only classify recruiter → jobseeker messages.
    // Jobseeker replies stay not_checked (protect applicants, not scan their chat).
    const isRecruiterSender = access.role === "recruiter";
    const recipientId = isRecruiterSender
      ? String(conversation.jobseekerId)
      : String(conversation.recruiterId);

    const deliveredAt =
      silentUndelivered ||
      !isUserOnline(
        recipientId,
        isRecruiterSender ? null : conversation.workspaceId
      )
        ? null
        : new Date();

    const scamAnalysis =
      isRecruiterSender && !silentUndelivered && body
        ? await analyzeMessageForScam(body, req.userId)
        : {
            status: "not_checked",
            isScam: false,
            score: null,
            tactics: [],
            analyzedAt: null,
          };

    const messageType = hasImage ? "image" : hasDocument ? "file" : "text";
    const attachment = hasImage
      ? await uploadChatImage(imageFile)
      : hasDocument
        ? await uploadChatDocument(documentFile)
        : null;
    uploadedAttachmentPublicId = attachment?.publicId ?? null;
    uploadedAttachmentResourceType = hasDocument ? "raw" : "image";

    const message = await Message.create({
      conversationId: conversation._id,
      senderId: String(req.userId),
      messageType,
      body,
      attachments: attachment ? [attachment] : [],
      status: deliveredAt ? "delivered" : "sent",
      deliveredAt,
      scamAnalysis,
      suppressedForPeer: silentUndelivered,
    });
    uploadedAttachmentCommitted = hasAttachment;

    if (!silentUndelivered) {
      const unreadField = isRecruiterSender
        ? "unreadCounts.jobseeker"
        : "unreadCounts.recruiter";

      await Conversation.findByIdAndUpdate(conversation._id, {
        $set: {
          lastMessage: {
            messageId: message._id,
            senderId: String(req.userId),
            preview: buildPreview(body) || buildAttachmentPreview(messageType, attachment),
            messageType,
            sentAt: message.createdAt,
          },
        },
        $inc: { [unreadField]: 1 },
      });

      const chatMessage = formatMessage(message);
      emitNewMessage(conversationId, chatMessage, eventConversation);

      // Notify the jobseeker in Notifications → General (banner already covers live toast).
      if (isRecruiterSender) {
        let companyName = conversation.workspaceName || "Recruiter";
        let jobTitle = "";
        const applicationResult = await fetchApplication(
          conversation.applicationId,
          req.headers.authorization
        );
        if (applicationResult.ok) {
          companyName =
            conversation.workspaceName ||
            applicationResult.application.companyName ||
            companyName;
          jobTitle = applicationResult.application.jobTitle || "";
        }

        const flagged =
          scamAnalysis.status === "flagged" || scamAnalysis.isScam === true;
        const preview = body
          ? body.length > 140
            ? `${body.slice(0, 137).trim()}…`
            : body
          : buildAttachmentPreview(messageType, attachment);

        void publishEvent(EVENT_TYPES.CHAT_MESSAGE_CREATED, {
          recipientId: conversation.jobseekerId,
          conversationId: String(conversation._id),
          messageId: String(message._id),
          applicationId: conversation.applicationId,
          jobId: conversation.jobId,
          workspaceId: conversation.workspaceId || null,
          companyName,
          jobTitle,
          preview,
          flagged,
          senderId: String(req.userId),
        });
      }

      return res.status(201).json({
        success: true,
        message: "Message sent successfully",
        chatMessage: formatMessage(message),
      });
    }

    // Silent path: only the sender gets the message back (peer never notified).
    return res.status(201).json({
      success: true,
      message: "Message sent successfully",
      chatMessage: formatMessage(message),
      silentUndelivered: true,
    });
  } catch (error) {
    if (!uploadedAttachmentCommitted) {
      await deleteUploadedAttachment(
        uploadedAttachmentPublicId,
        uploadedAttachmentResourceType
      );
    }
    console.error("Send message error:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: messages[0] || "Validation error",
        errors: messages,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Error sending message",
      error: error.message,
    });
  }
};

/**
 * PATCH /api/chat/conversations/:conversationId/read
 *
 * Marks the conversation as read for the caller:
 * - resets their unread count to 0
 * - sets peer messages to status "read"
 */
export const markConversationRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const access = await getParticipantConversation(conversationId, req);

    if (!access.ok) {
      return res.status(access.status).json({
        success: false,
        message: access.message,
      });
    }

    const conversation = access.conversation;
    const eventConversation = buildConversationEventContext(
      conversation,
      access
    );
    const isRecruiter = access.role === "recruiter";
    const unreadField = isRecruiter
      ? "unreadCounts.recruiter"
      : "unreadCounts.jobseeker";

    const now = new Date();

    await Promise.all([
      Conversation.findByIdAndUpdate(conversation._id, {
        $set: { [unreadField]: 0 },
      }),
      Message.updateMany(
        {
          conversationId: conversation._id,
          senderId: { $ne: String(req.userId) },
          status: { $ne: "read" },
        },
        {
          $set: {
            status: "read",
            readAt: now,
          },
        }
      ),
    ]);

    emitMessageStatus(
      conversationId,
      {
        readerId: String(req.userId),
        status: "read",
        readAt: now,
      },
      eventConversation
    );

    return res.status(200).json({
      success: true,
      message: "Conversation marked as read",
      conversationId,
      myUnread: 0,
    });
  } catch (error) {
    console.error("Mark conversation read error:", error);
    return res.status(500).json({
      success: false,
      message: "Error marking conversation as read",
      error: error.message,
    });
  }
};

export { formatMessage, getParticipantConversation };
