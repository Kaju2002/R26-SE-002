import Conversation from "../model/conversationModel.js";
import { fetchApplication } from "../utils/jobManagementClient.js";

const formatConversation = (conversation) => ({
  id: String(conversation._id),
  recruiterId: conversation.recruiterId,
  jobseekerId: conversation.jobseekerId,
  applicationId: conversation.applicationId,
  jobId: conversation.jobId,
  status: conversation.status,
  startedBy: conversation.startedBy,
  lastMessage: conversation.lastMessage || null,
  unreadCounts: conversation.unreadCounts || { recruiter: 0, jobseeker: 0 },
  createdAt: conversation.createdAt,
  updatedAt: conversation.updatedAt,
});

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
        conversation: formatConversation(existing),
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
      conversation: formatConversation(conversation),
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
          conversation: formatConversation(existing),
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
