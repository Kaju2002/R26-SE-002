import Conversation from "../model/conversationModel.js";
import Message from "../model/messageModel.js";
import { emitNewMessage, emitConversationStatus, isUserOnline } from "../config/socket.js";
import { publishEvent } from "../utils/publishEvent.js";
import { EVENT_TYPES } from "../constants/eventTypes.js";

const getInternalKey = () =>
  process.env.INTERNAL_SERVICE_KEY?.trim() ||
  process.env.CHAT_INTERNAL_SERVICE_KEY?.trim() ||
  "";

const assertInternalKey = (req, res) => {
  const expected = getInternalKey();
  const provided = String(req.headers["x-internal-service-key"] || "").trim();
  if (!expected || provided !== expected) {
    res.status(401).json({
      success: false,
      message: "Unauthorized internal request",
    });
    return false;
  }
  return true;
};

/**
 * POST /api/chat/internal/interview-reminder
 * Service-to-service: ensure conversation + post reminder as recruiter.
 */
export const postInterviewReminder = async (req, res) => {
  try {
    if (!assertInternalKey(req, res)) return;

    const applicationId = String(req.body?.applicationId || "").trim();
    const recruiterId = String(req.body?.recruiterId || "").trim();
    const jobseekerId = String(req.body?.jobseekerId || "").trim();
    const jobId = String(req.body?.jobId || "").trim();
    const workspaceId = req.body?.workspaceId
      ? String(req.body.workspaceId).trim()
      : null;
    const companyName = req.body?.companyName
      ? String(req.body.companyName).trim()
      : null;
    const body = String(req.body?.body || "").trim();

    if (!applicationId || !recruiterId || !jobseekerId || !jobId || !body) {
      return res.status(400).json({
        success: false,
        message:
          "applicationId, recruiterId, jobseekerId, jobId, and body are required",
      });
    }

    let conversation = await Conversation.findOne({ applicationId });
    if (!conversation) {
      conversation = await Conversation.create({
        recruiterId,
        jobseekerId,
        applicationId,
        jobId,
        workspaceId,
        workspaceName: companyName,
        startedBy: "recruiter",
        status: "active",
        unreadCounts: { recruiter: 0, jobseeker: 0 },
      });
    }

    if (conversation.status === "blocked") {
      return res.status(200).json({
        success: true,
        skipped: true,
        reason: "conversation-blocked",
        conversationId: String(conversation._id),
      });
    }

    const message = await Message.create({
      conversationId: conversation._id,
      senderId: recruiterId,
      messageType: "text",
      body,
      status: "sent",
    });

    const peerOnline = isUserOnline(jobseekerId);
    if (peerOnline) {
      message.status = "delivered";
      message.deliveredAt = new Date();
      await message.save();
    }

    conversation.lastMessage = {
      messageId: message._id,
      senderId: recruiterId,
      preview: body.slice(0, 160),
      messageType: "text",
      sentAt: message.createdAt,
    };
    conversation.unreadCounts = {
      recruiter: conversation.unreadCounts?.recruiter || 0,
      jobseeker: (conversation.unreadCounts?.jobseeker || 0) + 1,
    };
    await conversation.save();

    const formatted = {
      id: String(message._id),
      conversationId: String(conversation._id),
      senderId: recruiterId,
      messageType: "text",
      body,
      attachments: [],
      status: message.status,
      deliveredAt: message.deliveredAt,
      readAt: null,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    };

    emitNewMessage(String(conversation._id), formatted, conversation);
    emitConversationStatus(
      String(conversation._id),
      {
        lastMessage: conversation.lastMessage,
        unreadCounts: conversation.unreadCounts,
      },
      conversation
    );

    try {
      await publishEvent(EVENT_TYPES.CHAT_MESSAGE_CREATED, {
        conversationId: String(conversation._id),
        messageId: String(message._id),
        senderId: recruiterId,
        recipientId: jobseekerId,
        preview: body.slice(0, 120),
        applicationId,
        jobId,
      });
    } catch (error) {
      console.warn("Interview reminder chat event publish:", error.message);
    }

    return res.status(201).json({
      success: true,
      conversationId: String(conversation._id),
      messageId: String(message._id),
    });
  } catch (error) {
    console.error("Internal interview reminder error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Could not post interview reminder",
    });
  }
};
