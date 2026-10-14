import ChatReport, {
  CHAT_REPORT_FEEDBACK_VALUES,
  CHAT_REPORT_REASON_CODES,
  CHAT_REPORT_STATUS_VALUES,
} from "../model/chatReportModel.js";
import Message from "../model/messageModel.js";
import { getAuthorizedConversation } from "../utils/workspaceAuthorization.js";
import { recordAuditLog } from "../utils/auditLogClient.js";

const isValidObjectId = (id) => /^[a-fA-F0-9]{24}$/.test(String(id));

const parsePagination = (query) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 50);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

export const riskFromScore = (score) => {
  if (score === null || score === undefined || Number.isNaN(Number(score))) {
    return "caution";
  }
  return Number(score) >= 0.9 ? "high" : "caution";
};

const DELETED_PREVIEW = "This message was deleted";

/** Timeline label without the deleted message's text preview. */
const maskedTimelineLabel = (label) => {
  const text = String(label || "");
  if (text.startsWith("Flagged")) return "Flagged message (deleted by sender)";
  if (text.startsWith("Suspicious")) return "Suspicious message (deleted by sender)";
  return "Message deleted by sender";
};

/**
 * revealDeleted: true only for superadmin routes. Reporters see that a message was
 * deleted (and its scam result) but not the content the sender removed.
 */
const formatReport = (doc, { includeEvidence = true, revealDeleted = false } = {}) => {
  const base = {
    id: String(doc._id),
    conversationId: doc.conversationId,
    applicationId: doc.applicationId || "",
    jobId: doc.jobId || "",
    recruiterId: doc.recruiterId || "",
    jobseekerId: doc.jobseekerId || "",
    workspaceName: doc.workspaceName || "",
    peerLabel: doc.peerLabel || "",
    jobLabel: doc.jobLabel || "",
    reporterId: doc.reporterId,
    reporterName: doc.reporterName || "",
    reporterEmail: doc.reporterEmail || "",
    reporterRole: doc.reporterRole || "jobseeker",
    reasonCode: doc.reasonCode,
    details: doc.details || "",
    tacticsSummary: doc.tacticsSummary || [],
    flaggedCount: doc.flaggedCount || 0,
    maxScore: doc.maxScore ?? null,
    riskLevel: doc.riskLevel || "caution",
    status: doc.status,
    createdAt: doc.createdAt?.toISOString?.() || doc.createdAt,
    resolvedAt: doc.resolvedAt ? doc.resolvedAt.toISOString() : null,
    adminNote: doc.adminNote || null,
    feedback: doc.feedback || "none",
    feedbackAt: doc.feedbackAt ? doc.feedbackAt.toISOString() : null,
  };

  if (!includeEvidence) return base;

  const evidence = doc.evidenceMessages || [];
  const hiddenIds = new Set(
    revealDeleted
      ? []
      : evidence.filter((m) => m.deletedForEveryone).map((m) => String(m.messageId))
  );

  return {
    ...base,
    evidenceMessages: evidence.map((m) => {
      const hidden = hiddenIds.has(String(m.messageId));
      return {
        messageId: m.messageId,
        senderId: m.senderId,
        role: m.role,
        messageType: hidden ? "system" : m.messageType,
        body: hidden ? DELETED_PREVIEW : m.body,
        attachments: hidden
          ? []
          : (m.attachments || []).map((a) => ({
              url: a.url,
              fileName: a.fileName,
              mimeType: a.mimeType,
            })),
        deletedForEveryone: Boolean(m.deletedForEveryone),
        deletedAt: m.deletedAt ? new Date(m.deletedAt).toISOString() : null,
        createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : null,
        scamAnalysis: {
          status: m.scamAnalysis?.status || "not_checked",
          isScam: Boolean(m.scamAnalysis?.isScam),
          score: m.scamAnalysis?.score ?? null,
          tactics: m.scamAnalysis?.tactics || [],
          analyzedAt: m.scamAnalysis?.analyzedAt
            ? new Date(m.scamAnalysis.analyzedAt).toISOString()
            : null,
        },
      };
    }),
    timeline: (doc.timeline || []).map((point) => ({
      at: point.at ? new Date(point.at).toISOString() : null,
      label: hiddenIds.has(String(point.messageId))
        ? maskedTimelineLabel(point.label)
        : point.label,
      riskLevel: point.riskLevel,
      messageId: point.messageId,
      tactics: point.tactics || [],
      score: point.score ?? null,
    })),
  };
};

export const buildEvidencePack = (conversation, messages) => {
  const recruiterId = String(conversation.recruiterId);
  const evidenceMessages = messages.map((message) => {
    const senderId = String(message.senderId || "");
    const role =
      senderId === recruiterId
        ? "recruiter"
        : senderId === String(conversation.jobseekerId)
          ? "jobseeker"
          : "unknown";
    const analysis = message.scamAnalysis || {};
    return {
      messageId: String(message._id),
      senderId,
      role,
      messageType: message.messageType || "text",
      body: String(message.body || "").slice(0, 2000),
      attachments: (message.attachments || [])
        .filter((a) => a?.url)
        .map((a) => ({
          url: a.url,
          fileName: a.fileName || "",
          mimeType: a.mimeType || "",
        })),
      deletedForEveryone: Boolean(message.deletedForEveryone),
      deletedAt: message.deletedAt || null,
      createdAt: message.createdAt || null,
      scamAnalysis: {
        status: analysis.status || "not_checked",
        isScam: Boolean(analysis.isScam),
        score: analysis.score ?? null,
        tactics: Array.isArray(analysis.tactics) ? analysis.tactics : [],
        analyzedAt: analysis.analyzedAt || null,
      },
    };
  });

  const flagged = evidenceMessages.filter(
    (m) => m.scamAnalysis.status === "flagged" || m.scamAnalysis.isScam
  );

  const tacticsSet = new Set();
  let maxScore = null;
  for (const item of flagged) {
    for (const tactic of item.scamAnalysis.tactics) {
      if (tactic) tacticsSet.add(String(tactic));
    }
    if (typeof item.scamAnalysis.score === "number") {
      maxScore =
        maxScore === null
          ? item.scamAnalysis.score
          : Math.max(maxScore, item.scamAnalysis.score);
    }
  }

  // A recruiter deleting messages before a report is itself worth showing to moderators.
  const timeline = evidenceMessages
    .filter(
      (m) =>
        m.scamAnalysis.status === "flagged" ||
        m.scamAnalysis.isScam ||
        m.scamAnalysis.status === "suspicious" ||
        (m.deletedForEveryone && m.role === "recruiter")
    )
    .map((item) => {
      const isFlagged =
        item.scamAnalysis.status === "flagged" || item.scamAnalysis.isScam;
      const isSuspicious = item.scamAnalysis.status === "suspicious";
      const tactics = item.scamAnalysis.tactics || [];
      const score = item.scamAnalysis.score;
      const riskLevel = isFlagged ? riskFromScore(score) : "caution";
      let prefix = "Message deleted by sender";
      if (isFlagged || isSuspicious) {
        prefix = `${isFlagged ? "Flagged" : "Suspicious"} message`;
        if (item.deletedForEveryone) prefix += " (deleted by sender)";
      }
      const preview = (item.body || "").trim().slice(0, 80);
      return {
        at: item.createdAt || new Date(),
        label: preview
          ? `${prefix}: ${preview}`
          : `${prefix} (${item.messageType})`,
        riskLevel,
        messageId: item.messageId,
        tactics,
        score,
      };
    });

  if (!timeline.length && evidenceMessages.length) {
    const last = evidenceMessages[evidenceMessages.length - 1];
    timeline.push({
      at: last.createdAt || new Date(),
      label: "Conversation reported by jobseeker",
      riskLevel: "caution",
      messageId: last.messageId,
      tactics: [],
      score: null,
    });
  }

  return {
    evidenceMessages,
    timeline,
    tacticsSummary: [...tacticsSet],
    flaggedCount: flagged.length,
    maxScore,
    riskLevel: riskFromScore(maxScore),
  };
};

/**
 * POST /api/chat/conversations/:conversationId/reports
 * Jobseeker creates an evidence pack from recent messages.
 */
export const createChatReport = async (req, res) => {
  try {
    const conversationId = String(req.params.conversationId || "").trim();
    const reasonCode = String(req.body?.reasonCode || "").trim();
    const details = String(req.body?.details || "").trim().slice(0, 2000);
    const peerLabel = String(req.body?.peerLabel || "").trim().slice(0, 120);
    const jobLabel = String(req.body?.jobLabel || "").trim().slice(0, 160);
    const reporterName = String(req.body?.reporterName || "").trim().slice(0, 120);

    if (!CHAT_REPORT_REASON_CODES.includes(reasonCode)) {
      return res.status(400).json({
        success: false,
        message: "Invalid reasonCode",
      });
    }

    const access = await getAuthorizedConversation({
      conversationId,
      userId: req.userId,
      accountType: req.accountType,
      workspaceId: req.get("X-Workspace-Id"),
      authorizationHeader: req.headers.authorization,
    });
    if (!access.ok) {
      return res.status(access.status || 403).json({
        success: false,
        message: access.message,
      });
    }

    const { conversation } = access;
    if (String(conversation.jobseekerId) !== String(req.userId)) {
      return res.status(403).json({
        success: false,
        message: "Only the jobseeker can report this conversation",
      });
    }

    const existing = await ChatReport.findOne({
      reporterId: String(req.userId),
      conversationId: String(conversation._id),
      status: { $in: ["new", "reviewing"] },
    });
    if (existing) {
      return res.status(200).json({
        success: true,
        message: "An open report already exists for this chat",
        report: formatReport(existing),
        alreadyExists: true,
      });
    }

    const messages = await Message.find({ conversationId: conversation._id })
      .sort({ createdAt: 1 })
      .limit(80);

    const pack = buildEvidencePack(conversation, messages);

    const report = await ChatReport.create({
      conversationId: String(conversation._id),
      applicationId: conversation.applicationId || "",
      jobId: conversation.jobId || "",
      recruiterId: conversation.recruiterId || "",
      jobseekerId: conversation.jobseekerId || "",
      workspaceName: conversation.workspaceName || "",
      peerLabel:
        peerLabel ||
        conversation.workspaceName ||
        "Recruiter",
      jobLabel: jobLabel || "",
      reporterId: String(req.userId),
      reporterName: reporterName || req.email?.split("@")[0] || "Jobseeker",
      reporterEmail: req.email || "",
      reporterRole: "jobseeker",
      reasonCode,
      details,
      ...pack,
    });

    return res.status(201).json({
      success: true,
      message: "Evidence pack saved",
      report: formatReport(report),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "You already have an open report for this chat",
      });
    }
    console.error("createChatReport error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not create chat report",
      error: error.message,
    });
  }
};

/**
 * GET /api/chat/conversations/:conversationId/reports/me
 */
export const getMyChatReport = async (req, res) => {
  try {
    const conversationId = String(req.params.conversationId || "").trim();
    const access = await getAuthorizedConversation({
      conversationId,
      userId: req.userId,
      accountType: req.accountType,
      workspaceId: req.get("X-Workspace-Id"),
      authorizationHeader: req.headers.authorization,
    });
    if (!access.ok) {
      return res.status(access.status || 403).json({
        success: false,
        message: access.message,
      });
    }

    const report = await ChatReport.findOne({
      reporterId: String(req.userId),
      conversationId: String(access.conversation._id),
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      report: report ? formatReport(report) : null,
    });
  } catch (error) {
    console.error("getMyChatReport error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load chat report",
      error: error.message,
    });
  }
};

/**
 * PATCH /api/chat/reports/:reportId/feedback
 * Body: { feedback: "helpful" | "false_alarm" }
 */
export const updateChatReportFeedback = async (req, res) => {
  try {
    const reportId = String(req.params.reportId || "").trim();
    const feedback = String(req.body?.feedback || "").trim();

    if (!isValidObjectId(reportId)) {
      return res.status(400).json({ success: false, message: "Invalid report id" });
    }
    if (!["helpful", "false_alarm"].includes(feedback)) {
      return res.status(400).json({
        success: false,
        message: "feedback must be helpful or false_alarm",
      });
    }

    const report = await ChatReport.findById(reportId);
    if (!report) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }
    if (String(report.reporterId) !== String(req.userId)) {
      return res.status(403).json({
        success: false,
        message: "Only the reporter can leave feedback",
      });
    }

    report.feedback = feedback;
    report.feedbackAt = new Date();
    await report.save();

    return res.status(200).json({
      success: true,
      message: "Feedback saved",
      report: formatReport(report),
    });
  } catch (error) {
    console.error("updateChatReportFeedback error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not save feedback",
      error: error.message,
    });
  }
};

/**
 * GET /api/chat/reports — superadmin list
 */
export const listChatReports = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const status = String(req.query.status || "").trim();
    const filter = {};
    if (CHAT_REPORT_STATUS_VALUES.includes(status)) {
      filter.status = status;
    }

    const [items, total] = await Promise.all([
      ChatReport.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      ChatReport.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      reports: items.map((doc) => formatReport(doc, { includeEvidence: false })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    console.error("listChatReports error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not list chat reports",
      error: error.message,
    });
  }
};

/**
 * GET /api/chat/reports/:reportId — superadmin detail with evidence
 */
export const getChatReport = async (req, res) => {
  try {
    const reportId = String(req.params.reportId || "").trim();
    if (!isValidObjectId(reportId)) {
      return res.status(400).json({ success: false, message: "Invalid report id" });
    }

    const report = await ChatReport.findById(reportId);
    if (!report) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }

    return res.status(200).json({
      success: true,
      report: formatReport(report, { revealDeleted: true }),
    });
  } catch (error) {
    console.error("getChatReport error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load chat report",
      error: error.message,
    });
  }
};

/**
 * PATCH /api/chat/reports/:reportId — superadmin status update
 */
export const updateChatReportStatus = async (req, res) => {
  try {
    const reportId = String(req.params.reportId || "").trim();
    const status = String(req.body?.status || "").trim();
    const adminNote = String(req.body?.adminNote || "").trim().slice(0, 2000);

    if (!isValidObjectId(reportId)) {
      return res.status(400).json({ success: false, message: "Invalid report id" });
    }
    if (!CHAT_REPORT_STATUS_VALUES.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const report = await ChatReport.findById(reportId);
    if (!report) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }

    const previousStatus = report.status;
    const targetLabel =
      report.peerLabel && report.jobLabel
        ? `${report.peerLabel} · ${report.jobLabel}`
        : report.peerLabel || report.jobLabel || "Chat report";

    report.status = status;
    if (adminNote) report.adminNote = adminNote;
    report.moderatedBy = String(req.userId);
    report.resolvedAt =
      status === "resolved" || status === "dismissed" ? new Date() : null;
    await report.save();

    if (
      (status === "resolved" || status === "dismissed") &&
      previousStatus !== status
    ) {
      void recordAuditLog(req, {
        action: status === "resolved" ? "report.resolve" : "report.dismiss",
        targetType: "report",
        targetId: String(report._id),
        targetLabel,
        summary:
          status === "resolved"
            ? `Resolved chat report on ${targetLabel}`
            : `Dismissed chat report on ${targetLabel}`,
        before: { status: previousStatus },
        after: { status },
        note: adminNote || null,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Report updated",
      report: formatReport(report, { revealDeleted: true }),
    });
  } catch (error) {
    console.error("updateChatReportStatus error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not update chat report",
      error: error.message,
    });
  }
};

export { CHAT_REPORT_FEEDBACK_VALUES, CHAT_REPORT_REASON_CODES };
