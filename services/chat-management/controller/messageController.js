import mongoose from "mongoose";
import Conversation from "../model/conversationModel.js";
import Message from "../model/messageModel.js";
import { emitNewMessage } from "../config/socket.js";
import { analyzeMessageForScam } from "../utils/scamDetectionClient.js";
import { fetchApplication } from "../utils/jobManagementClient.js";
import { publishEvent } from "../utils/publishEvent.js";
import { EVENT_TYPES } from "../constants/eventTypes.js";

const isValidObjectId = (id) => /^[a-fA-F0-9]{24}$/.test(String(id));

const parsePagination = (query) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 100);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

const formatMessage = (message) => ({
  id: String(message._id),
  conversationId: String(message.conversationId),
  senderId: message.senderId,
  messageType: message.messageType,
  body: message.body || "",
  attachments: message.attachments || [],
  status: message.status,
  deliveredAt: message.deliveredAt,
  readAt: message.readAt,
  scamAnalysis: message.scamAnalysis || { status: "not_checked", isScam: false },
  createdAt: message.createdAt,
  updatedAt: message.updatedAt,
});

/**
 * Load a conversation and ensure the caller is a participant.
 * Returns { ok, status?, message?, conversation? }.
 */
const getParticipantConversation = async (conversationId, userId) => {
  if (!isValidObjectId(conversationId)) {
    return {
      ok: false,
      status: 400,
      message: "Invalid conversation id",
    };
  }

  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    return {
      ok: false,
      status: 404,
      message: "Conversation not found",
    };
  }

  const isParticipant =
    String(conversation.recruiterId) === String(userId) ||
    String(conversation.jobseekerId) === String(userId);

  if (!isParticipant) {
    return {
      ok: false,
      status: 403,
      message: "You are not a participant of this conversation",
    };
  }

  return { ok: true, conversation };
};

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
    const access = await getParticipantConversation(conversationId, req.userId);

    if (!access.ok) {
      return res.status(access.status).json({
        success: false,
        message: access.message,
      });
    }

    const { page, limit, skip } = parsePagination(req.query);
    const filter = {
      conversationId: new mongoose.Types.ObjectId(conversationId),
    };

    const [messages, total] = await Promise.all([
      Message.find(filter).sort({ createdAt: 1 }).skip(skip).limit(limit),
      Message.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Messages fetched successfully",
      conversationId,
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

const buildPreview = (body = "") => {
  const trimmed = String(body).trim();
  if (!trimmed) return "";
  return trimmed.length > 160 ? `${trimmed.slice(0, 157)}...` : trimmed;
};

/**
 * POST /api/chat/conversations/:conversationId/messages
 * Body: { body: "Hello" }
 *
 * Saves a text message from the authenticated participant,
 * runs scam-detection for recruiter messages only (FraudAware),
 * updates lastMessage + unread, then broadcasts message:new over Socket.io.
 */
export const sendMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const access = await getParticipantConversation(conversationId, req.userId);

    if (!access.ok) {
      return res.status(access.status).json({
        success: false,
        message: access.message,
      });
    }

    const conversation = access.conversation;

    if (conversation.status === "blocked") {
      return res.status(403).json({
        success: false,
        message: "This conversation is blocked. You cannot send messages.",
      });
    }

    const body = String(req.body?.body ?? "").trim();
    if (!body) {
      return res.status(400).json({
        success: false,
        message: "Message body is required",
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
    const isRecruiterSender =
      String(conversation.recruiterId) === String(req.userId);

    const scamAnalysis = isRecruiterSender
      ? await analyzeMessageForScam(body, req.userId)
      : {
          status: "not_checked",
          isScam: false,
          score: null,
          tactics: [],
          analyzedAt: null,
        };

    const message = await Message.create({
      conversationId: conversation._id,
      senderId: String(req.userId),
      messageType: "text",
      body,
      status: "sent",
      scamAnalysis,
    });

    const unreadField = isRecruiterSender
      ? "unreadCounts.jobseeker"
      : "unreadCounts.recruiter";

    await Conversation.findByIdAndUpdate(conversation._id, {
      $set: {
        lastMessage: {
          messageId: message._id,
          senderId: String(req.userId),
          preview: buildPreview(body),
          messageType: "text",
          sentAt: message.createdAt,
        },
      },
      $inc: { [unreadField]: 1 },
    });

    const chatMessage = formatMessage(message);
    emitNewMessage(conversationId, chatMessage, [
      conversation.recruiterId,
      conversation.jobseekerId,
    ]);

    // Notify the jobseeker in Notifications → General (banner already covers live toast).
    if (isRecruiterSender) {
      let companyName = "Recruiter";
      let jobTitle = "";
      const applicationResult = await fetchApplication(
        conversation.applicationId,
        req.headers.authorization
      );
      if (applicationResult.ok) {
        companyName =
          applicationResult.application.companyName || companyName;
        jobTitle = applicationResult.application.jobTitle || "";
      }

      const flagged =
        scamAnalysis.status === "flagged" || scamAnalysis.isScam === true;
      const preview =
        body.length > 140 ? `${body.slice(0, 137).trim()}…` : body;

      void publishEvent(EVENT_TYPES.CHAT_MESSAGE_CREATED, {
        recipientId: conversation.jobseekerId,
        conversationId: String(conversation._id),
        messageId: String(message._id),
        applicationId: conversation.applicationId,
        jobId: conversation.jobId,
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
      chatMessage,
    });
  } catch (error) {
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
    const access = await getParticipantConversation(conversationId, req.userId);

    if (!access.ok) {
      return res.status(access.status).json({
        success: false,
        message: access.message,
      });
    }

    const conversation = access.conversation;
    const isRecruiter = String(conversation.recruiterId) === String(req.userId);
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
