import Conversation from "../model/conversationModel.js";
import { fetchApplication } from "../utils/jobManagementClient.js";
import { emitConversationStatus } from "../config/socket.js";
import {
  authorizeConversation,
  buildConversationEventContext,
  getAuthorizedConversation,
  getRequestWorkspaceId,
  isEmployerAccount,
  validateWorkspaceMembership,
} from "../utils/workspaceAuthorization.js";

const parsePagination = (query) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 50);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

const formatConversation = (conversation, viewerId = null) => {
  const unreadCounts = conversation.unreadCounts || {
    recruiter: 0,
    jobseeker: 0,
  };
  const clearedAt = conversation.clearedAt || {};

  let lastMessage = conversation.lastMessage || null;

  if (viewerId && lastMessage?.sentAt) {
    const isRecruiter =
      String(conversation.jobseekerId) !== String(viewerId);
    const viewerClearedAt = isRecruiter ? clearedAt.recruiter : clearedAt.jobseeker;
    if (
      viewerClearedAt &&
      new Date(lastMessage.sentAt).getTime() <= new Date(viewerClearedAt).getTime()
    ) {
      lastMessage = {
        messageId: null,
        senderId: null,
        preview: "",
        messageType: "text",
        sentAt: null,
      };
    }
  }

  const base = {
    id: String(conversation._id),
    recruiterId: conversation.recruiterId,
    workspaceId: conversation.workspaceId
      ? String(conversation.workspaceId)
      : null,
    workspaceName: conversation.workspaceName || null,
    jobseekerId: conversation.jobseekerId,
    applicationId: conversation.applicationId,
    jobId: conversation.jobId,
    status: conversation.status,
    blockedBy: conversation.blockedBy ? String(conversation.blockedBy) : null,
    startedBy: conversation.startedBy,
    lastMessage,
    unreadCounts,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };

  if (!viewerId) return base;

  const isRecruiter =
    String(conversation.jobseekerId) !== String(viewerId);
  const myRole = isRecruiter ? "recruiter" : "jobseeker";
  const blockedBy = base.blockedBy;
  // Legacy rows may be status=blocked without blockedBy — treat as mutual for both.
  const iBlocked =
    conversation.status === "blocked" &&
    (blockedBy ? blockedBy === String(viewerId) : true);

  return {
    ...base,
    myRole,
    myUnread: isRecruiter ? unreadCounts.recruiter : unreadCounts.jobseeker,
    peerId: isRecruiter ? conversation.jobseekerId : conversation.recruiterId,
    clearedAt: isRecruiter ? clearedAt.recruiter ?? null : clearedAt.jobseeker ?? null,
    iBlocked,
    saved: (conversation.savedBy || []).some(
      (userId) => String(userId) === String(viewerId)
    ),
  };
};

/**
 * POST /api/chat/conversations
 * Body: { applicationId }
 *
 * Creates (or returns) the single conversation tied to a job application.
 * The caller must be a participant of that application (recruiter or applicant),
 * which is verified by job-management via fetchApplication().
 */
export const createConversation = async (req, res) => {
  try {
    const applicationId = String(req.body?.applicationId || "").trim();

    if (!applicationId) {
      return res.status(400).json({
        success: false,
        message: "applicationId is required",
      });
    }

    // Validate the application + participant permissions via job-management.
    const result = await fetchApplication(applicationId, req.headers.authorization);
    if (!result.ok) {
      return res.status(result.status || 502).json({
        success: false,
        message: result.message,
      });
    }

    const {
      recruiterId,
      applicantId,
      jobId,
      workspaceId: applicationWorkspaceId,
      companyName,
    } = result.application;
    const workspaceId = applicationWorkspaceId
      ? String(applicationWorkspaceId)
      : null;

    // Figure out which side the caller is on.
    let startedBy;
    if (isEmployerAccount(req.accountType)) {
      if (String(req.userId) !== String(recruiterId)) {
        return res.status(403).json({
          success: false,
          message: "You are not allowed to create this application conversation",
        });
      }
      if (workspaceId) {
        const requestedWorkspaceId = getRequestWorkspaceId(req);
        if (requestedWorkspaceId !== workspaceId) {
          return res.status(requestedWorkspaceId ? 403 : 400).json({
            success: false,
            message: requestedWorkspaceId
              ? "Workspace does not match this application"
              : "X-Workspace-Id is required for workspace applications",
          });
        }
        const membership = await validateWorkspaceMembership({
          workspaceId,
          authorizationHeader: req.headers.authorization,
          cache: (req.workspaceMembershipCache ??= new Map()),
        });
        if (!membership.ok) {
          return res.status(membership.status).json({
            success: false,
            message: membership.message,
          });
        }
      }
      startedBy = "recruiter";
    } else if (String(req.userId) === String(applicantId)) {
      startedBy = "jobseeker";
    } else {
      return res.status(403).json({
        success: false,
        message: "You are not a participant of this application",
      });
    }

    if (String(recruiterId) === String(applicantId)) {
      return res.status(400).json({
        success: false,
        message: "Recruiter and jobseeker must be different users",
      });
    }

    // Idempotent: one conversation per application.
    const existing = await Conversation.findOne({ applicationId });
    if (existing) {
      const access = await authorizeConversation({
        conversation: existing,
        userId: req.userId,
        accountType: req.accountType,
        workspaceId: getRequestWorkspaceId(req),
        authorizationHeader: req.headers.authorization,
        membershipCache: (req.workspaceMembershipCache ??= new Map()),
      });
      if (!access.ok) {
        return res.status(access.status).json({
          success: false,
          message: access.message,
        });
      }
      return res.status(200).json({
        success: true,
        message: "Conversation already exists",
        conversation: formatConversation(existing, req.userId),
      });
    }

    const conversation = await Conversation.create({
      recruiterId: String(recruiterId),
      workspaceId,
      workspaceName: companyName ? String(companyName) : null,
      jobseekerId: String(applicantId),
      applicationId,
      jobId: String(jobId),
      startedBy,
    });

    return res.status(201).json({
      success: true,
      message: "Conversation created successfully",
      conversation: formatConversation(conversation, req.userId),
    });
  } catch (error) {
    console.error("Create conversation error:", error);

    // Unique index race: another request created it first.
    if (error.code === 11000) {
      const existing = await Conversation.findOne({
        applicationId: String(req.body?.applicationId || "").trim(),
      });
      if (existing) {
        return res.status(200).json({
          success: true,
          message: "Conversation already exists",
          conversation: formatConversation(existing, req.userId),
        });
      }
    }

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
      message: "Error creating conversation",
      error: error.message,
    });
  }
};

/**
 * GET /api/chat/conversations
 * Query: ?page=1&limit=20&status=active
 *
 * Returns conversations where the caller is recruiter or jobseeker.
 * Sorted by most recently updated first (inbox order).
 */
export const listConversations = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const status = String(req.query.status || "").trim();

    let filter;
    if (isEmployerAccount(req.accountType)) {
      const workspaceId = getRequestWorkspaceId(req);
      if (workspaceId) {
        const membership = await validateWorkspaceMembership({
          workspaceId,
          authorizationHeader: req.headers.authorization,
          cache: (req.workspaceMembershipCache ??= new Map()),
        });
        if (!membership.ok) {
          return res.status(membership.status).json({
            success: false,
            message: membership.message,
          });
        }
        filter = { workspaceId };
      } else {
        filter = {
          recruiterId: String(req.userId),
          $or: [
            { workspaceId: null },
            { workspaceId: "" },
            { workspaceId: { $exists: false } },
          ],
        };
      }
    } else {
      filter = { jobseekerId: String(req.userId) };
    }

    if (status) {
      const allowed = ["active", "archived", "blocked"];
      if (!allowed.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Use one of: ${allowed.join(", ")}`,
        });
      }
      filter.status = status;
    }

    const [conversations, total] = await Promise.all([
      Conversation.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit),
      Conversation.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Conversations fetched successfully",
      conversations: conversations.map((c) => formatConversation(c, req.userId)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    });
  } catch (error) {
    console.error("List conversations error:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching conversations",
      error: error.message,
    });
  }
};

/**
 * PATCH /api/chat/conversations/:conversationId/status
 * Body: { status: "active" | "archived" | "blocked" }
 *
 * Archive is a conversation-level state shared by both participants.
 * WhatsApp-style asymmetric block:
 * - Block: sets status=blocked and blockedBy=caller
 * - Unblock: only the blocker (blockedBy) may restore active
 * - Peer is not shown a "you were blocked" UI (client uses iBlocked)
 */
export const updateConversationStatus = async (req, res) => {
  try {
    const conversationId = String(req.params.conversationId || "").trim();
    const status = String(req.body?.status || "").trim();
    const allowed = ["active", "archived", "blocked"];

    if (!/^[a-fA-F0-9]{24}$/.test(conversationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation id",
      });
    }

    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Use one of: ${allowed.join(", ")}`,
      });
    }

    const access = await getAuthorizedConversation({
      conversationId,
      userId: req.userId,
      accountType: req.accountType,
      workspaceId: getRequestWorkspaceId(req),
      authorizationHeader: req.headers.authorization,
      membershipCache: (req.workspaceMembershipCache ??= new Map()),
    });
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

    const callerId = String(req.userId);
    const existingBlockedBy = conversation.blockedBy
      ? String(conversation.blockedBy)
      : null;

    if (status === "archived") {
      if (conversation.status === "blocked") {
        return res.status(409).json({
          success: false,
          code: "CONVERSATION_BLOCKED",
          message: "Unblock the conversation before archiving it",
        });
      }

      if (conversation.status === "archived") {
        return res.status(200).json({
          success: true,
          message: "Conversation is already archived",
          conversation: formatConversation(conversation, req.userId),
        });
      }

      conversation.status = "archived";
      conversation.blockedBy = null;
      await conversation.save();

      emitConversationStatus(
        conversationId,
        {
          status: "archived",
          blockedBy: null,
          updatedBy: callerId,
          updatedAt: new Date(),
        },
        eventConversation
      );

      return res.status(200).json({
        success: true,
        message: "Conversation archived successfully",
        conversation: formatConversation(conversation, req.userId),
      });
    }

    if (status === "blocked") {
      conversation.status = "blocked";
      conversation.blockedBy = callerId;
      await conversation.save();

      emitConversationStatus(
        conversationId,
        {
          status: "blocked",
          blockedBy: callerId,
          updatedBy: callerId,
          updatedAt: new Date(),
        },
        eventConversation
      );

      return res.status(200).json({
        success: true,
        message: "Conversation blocked successfully",
        conversation: formatConversation(conversation, req.userId),
      });
    }

    // Restore an archived or blocked conversation to active.
    if (conversation.status === "active") {
      return res.status(200).json({
        success: true,
        message: "Conversation is already active",
        conversation: formatConversation(conversation, req.userId),
      });
    }

    // Only the blocker can unblock (legacy: no blockedBy → either participant).
    if (
      conversation.status === "blocked" &&
      existingBlockedBy &&
      existingBlockedBy !== callerId
    ) {
      return res.status(403).json({
        success: false,
        code: "NOT_BLOCKER",
        message: "Only the person who blocked can unblock this conversation",
      });
    }

    const wasBlocked = conversation.status === "blocked";
    conversation.status = "active";
    conversation.blockedBy = null;
    await conversation.save();

    emitConversationStatus(
      conversationId,
      {
        status: "active",
        blockedBy: null,
        updatedBy: callerId,
        updatedAt: new Date(),
      },
      eventConversation
    );

    return res.status(200).json({
      success: true,
      message: wasBlocked
        ? "Conversation unblocked successfully"
        : "Conversation unarchived successfully",
      conversation: formatConversation(conversation, req.userId),
    });
  } catch (error) {
    console.error("Update conversation status error:", error);
    return res.status(500).json({
      success: false,
      message: "Error updating conversation status",
      error: error.message,
    });
  }
};

/**
 * PATCH /api/chat/conversations/:conversationId/saved
 * Body: { saved: boolean }
 *
 * Saves or unsaves a conversation for the authenticated participant only.
 */
export const updateConversationSaved = async (req, res) => {
  try {
    const conversationId = String(req.params.conversationId || "").trim();
    if (!/^[a-fA-F0-9]{24}$/.test(conversationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation id",
      });
    }

    if (typeof req.body?.saved !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "saved must be a boolean",
      });
    }

    const access = await getAuthorizedConversation({
      conversationId,
      userId: req.userId,
      accountType: req.accountType,
      workspaceId: getRequestWorkspaceId(req),
      authorizationHeader: req.headers.authorization,
      membershipCache: (req.workspaceMembershipCache ??= new Map()),
    });
    if (!access.ok) {
      return res.status(access.status).json({
        success: false,
        message: access.message,
      });
    }
    const participantFilter = { _id: access.conversation._id };
    const update = req.body.saved
      ? { $addToSet: { savedBy: String(req.userId) } }
      : { $pull: { savedBy: String(req.userId) } };
    const conversation = await Conversation.findOneAndUpdate(
      participantFilter,
      update,
      { new: true }
    );

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: req.body.saved
        ? "Conversation saved successfully"
        : "Conversation removed from saved",
      conversation: formatConversation(conversation, req.userId),
    });
  } catch (error) {
    console.error("Update conversation saved error:", error);
    return res.status(500).json({
      success: false,
      message: "Error updating saved conversation",
      error: error.message,
    });
  }
};
