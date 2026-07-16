import Conversation from "../model/conversationModel.js";
import { fetchApplication } from "../utils/jobManagementClient.js";

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

  const base = {
    id: String(conversation._id),
    recruiterId: conversation.recruiterId,
    jobseekerId: conversation.jobseekerId,
    applicationId: conversation.applicationId,
    jobId: conversation.jobId,
    status: conversation.status,
    startedBy: conversation.startedBy,
    lastMessage: conversation.lastMessage || null,
    unreadCounts,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };

  if (!viewerId) return base;

  const isRecruiter = String(conversation.recruiterId) === String(viewerId);
  const myRole = isRecruiter ? "recruiter" : "jobseeker";

  return {
    ...base,
    myRole,
    myUnread: isRecruiter ? unreadCounts.recruiter : unreadCounts.jobseeker,
    peerId: isRecruiter ? conversation.jobseekerId : conversation.recruiterId,
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

    const { recruiterId, applicantId, jobId } = result.application;

    // Figure out which side the caller is on.
    let startedBy;
    if (String(req.userId) === String(recruiterId)) {
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
      return res.status(200).json({
        success: true,
        message: "Conversation already exists",
        conversation: formatConversation(existing, req.userId),
      });
    }

    const conversation = await Conversation.create({
      recruiterId: String(recruiterId),
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

    const filter = {
      $or: [{ recruiterId: req.userId }, { jobseekerId: req.userId }],
    };

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
