import Job from "../model/jobModel.js";
import Report, {
  REPORT_REASON_CODES,
  REPORT_STATUS_VALUES,
} from "../model/reportModel.js";
import { EVENT_TYPES } from "../constants/eventTypes.js";
import { publishEvent } from "../utils/publishEvent.js";
import { recordAuditLog } from "../utils/auditLogClient.js";

const isValidObjectId = (id) => /^[a-fA-F0-9]{24}$/.test(String(id));

const parsePagination = (query) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 50);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

const displayNameFromUser = (user) => {
  if (!user) return "User";
  const full = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  if (full) return full;
  if (user.name?.trim()) return user.name.trim();
  if (user.email?.trim()) return user.email.trim().split("@")[0];
  return "User";
};

const formatReport = (doc) => ({
  id: String(doc._id),
  targetType: doc.targetType,
  targetId: String(doc.targetId),
  targetLabel: doc.targetLabel || "",
  reporterId: doc.reporterId,
  reporterName: doc.reporterName || "",
  reporterEmail: doc.reporterEmail || "",
  reasonCode: doc.reasonCode,
  details: doc.details || "",
  status: doc.status,
  createdAt: doc.createdAt?.toISOString?.() || doc.createdAt,
  resolvedAt: doc.resolvedAt ? doc.resolvedAt.toISOString() : null,
  adminNote: doc.adminNote || null,
});

const publishJobFlaggedEvent = async (job) => {
  if (!job || String(job.moderationStatus) !== "flagged") return false;

  return publishEvent(EVENT_TYPES.JOB_FLAGGED_FOR_REVIEW, {
    jobId: String(job._id),
    jobTitle: job.title || "",
    companyName: job.companyName || "",
    companyLogo: job.companyLogo || null,
    posterName: job.posterName || "",
    posterEmail: job.posterEmail || "",
    postedBy: job.postedBy ? String(job.postedBy) : undefined,
    prediction: job.riskCheck?.prediction || "user_report",
    fakeProbability: job.riskCheck?.fakeProbability ?? null,
    message: job.riskCheck?.message || "Job flagged from a user report.",
  });
};

/**
 * Push a reported job into the Jobs moderation "flagged" queue.
 * @param {object} job - mongoose job doc
 * @param {{ bumpCount?: boolean }} options
 */
export const applyUserReportFlagToJob = async (job, { bumpCount = true } = {}) => {
  if (!job) return { job, changed: false };
  if (String(job.moderationStatus) === "force_closed") {
    return { job, changed: false, skipped: "force_closed" };
  }

  const reasons = new Set(
    Array.isArray(job.flagReasons) ? job.flagReasons.map(String) : []
  );
  reasons.add("user_report");
  job.flagReasons = [...reasons];

  if (bumpCount) {
    job.reportCount = Math.max(0, Number(job.reportCount) || 0) + 1;
  }

  const wasFlagged = String(job.moderationStatus) === "flagged";
  if (!wasFlagged) {
    job.moderationStatus = "flagged";
    job.flaggedAt = new Date();
  }

  await job.save();

  if (!wasFlagged) {
    void publishJobFlaggedEvent(job);
  }

  return { job, changed: true, newlyFlagged: !wasFlagged };
};

// ============ CREATE JOB REPORT (seeker) ============
export const createJobReport = async (req, res) => {
  try {
    const jobId = String(req.params.id || "").trim();
    if (!isValidObjectId(jobId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid job id",
      });
    }

    const reasonCode = String(req.body?.reasonCode || "").trim();
    if (!REPORT_REASON_CODES.includes(reasonCode)) {
      return res.status(400).json({
        success: false,
        message: "Invalid reason code",
      });
    }

    const details = String(req.body?.details || "")
      .trim()
      .slice(0, 2000);

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    if (String(job.postedBy) === String(req.userId)) {
      return res.status(400).json({
        success: false,
        message: "You cannot report your own job",
      });
    }

    const existingOpen = await Report.findOne({
      reporterId: req.userId,
      targetId: jobId,
      status: { $in: ["new", "reviewing"] },
    });

    if (existingOpen) {
      return res.status(409).json({
        success: false,
        message: "You already reported this job",
        report: formatReport(existingOpen),
      });
    }

    const targetLabel = `${job.title} · ${job.companyName}`.trim();

    const report = await Report.create({
      targetType: "job",
      targetId: jobId,
      targetLabel,
      reporterId: req.userId,
      reporterName: displayNameFromUser(req.user),
      reporterEmail: req.userEmail || req.user?.email || "",
      reasonCode,
      details,
      status: "new",
    });

    await applyUserReportFlagToJob(job, { bumpCount: true });

    return res.status(201).json({
      success: true,
      message: "Report submitted successfully",
      report: formatReport(report),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "You already reported this job",
      });
    }
    console.error("Create job report error:", error);
    return res.status(500).json({
      success: false,
      message: "Error submitting report",
      error: error.message,
    });
  }
};

// ============ MY REPORT FOR JOB ============
export const getMyJobReport = async (req, res) => {
  try {
    const jobId = String(req.params.id || "").trim();
    if (!isValidObjectId(jobId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid job id",
      });
    }

    const report = await Report.findOne({
      reporterId: req.userId,
      targetId: jobId,
      status: { $in: ["new", "reviewing"] },
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: report ? "Open report found" : "No open report",
      report: report ? formatReport(report) : null,
    });
  } catch (error) {
    console.error("Get my job report error:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching report",
      error: error.message,
    });
  }
};

// ============ LIST REPORTS (superadmin) ============
export const listReports = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const status = String(req.query.status || "").trim();
    const filter = {};

    if (REPORT_STATUS_VALUES.includes(status)) {
      filter.status = status;
    } else if (status === "open") {
      filter.status = { $in: ["new", "reviewing"] };
    }

    const [reports, total] = await Promise.all([
      Report.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Report.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Reports fetched successfully",
      reports: reports.map(formatReport),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    });
  } catch (error) {
    console.error("List reports error:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching reports",
      error: error.message,
    });
  }
};

// ============ UPDATE REPORT STATUS (superadmin) ============
export const updateReportStatus = async (req, res) => {
  try {
    const reportId = String(req.params.reportId || "").trim();
    if (!isValidObjectId(reportId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid report id",
      });
    }

    const status = String(req.body?.status || "").trim();
    if (!REPORT_STATUS_VALUES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    const adminNote = String(req.body?.adminNote || "").trim().slice(0, 2000);

    if (
      (status === "resolved" || status === "dismissed") &&
      !adminNote
    ) {
      return res.status(400).json({
        success: false,
        message: "Admin note is required to resolve or dismiss",
      });
    }

    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    const previousStatus = report.status;
    const targetLabel =
      report.targetLabel ||
      `${report.targetType} · ${report.reasonCode || "report"}`;

    report.status = status;
    if (adminNote) report.adminNote = adminNote;
    report.moderatedBy = req.userId;

    if (status === "resolved" || status === "dismissed") {
      report.resolvedAt = new Date();
    } else {
      report.resolvedAt = null;
    }

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
            ? `Resolved report on ${targetLabel}`
            : `Dismissed report on ${targetLabel}`,
        before: { status: previousStatus },
        after: { status },
        note: adminNote || null,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Report updated successfully",
      report: formatReport(report),
    });
  } catch (error) {
    console.error("Update report status error:", error);
    return res.status(500).json({
      success: false,
      message: "Error updating report",
      error: error.message,
    });
  }
};

// ============ FLAG JOB FROM EXISTING REPORT (superadmin) ============
export const flagJobFromReport = async (req, res) => {
  try {
    const reportId = String(req.params.reportId || "").trim();
    if (!isValidObjectId(reportId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid report id",
      });
    }

    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    if (report.targetType !== "job") {
      return res.status(400).json({
        success: false,
        message: "Only job reports can be sent to job moderation",
      });
    }

    const job = await Job.findById(report.targetId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Reported job not found",
      });
    }

    const result = await applyUserReportFlagToJob(job, { bumpCount: false });
    if (result.skipped === "force_closed") {
      return res.status(400).json({
        success: false,
        message: "This job is already force-closed",
      });
    }

    return res.status(200).json({
      success: true,
      message: result.newlyFlagged
        ? "Job sent to Flagged queue"
        : "Job is already in the Flagged queue",
      report: formatReport(report),
      jobId: String(job._id),
      moderationStatus: job.moderationStatus,
    });
  } catch (error) {
    console.error("Flag job from report error:", error);
    return res.status(500).json({
      success: false,
      message: "Error flagging job from report",
      error: error.message,
    });
  }
};

// ============ FORCE-CLOSE JOB FROM REPORT (superadmin) ============
export const forceCloseJobFromReport = async (req, res) => {
  try {
    const reportId = String(req.params.reportId || "").trim();
    if (!isValidObjectId(reportId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid report id",
      });
    }

    const closeReason = String(req.body?.closeReason || "").trim();
    if (!closeReason) {
      return res.status(400).json({
        success: false,
        message: "Add a force-close reason",
      });
    }

    const adminNote = String(
      req.body?.adminNote || closeReason
    )
      .trim()
      .slice(0, 2000);

    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    if (report.targetType !== "job") {
      return res.status(400).json({
        success: false,
        message: "Only job reports can force-close a listing",
      });
    }

    const job = await Job.findById(report.targetId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Reported job not found",
      });
    }

    if (String(job.moderationStatus) === "force_closed") {
      return res.status(400).json({
        success: false,
        message: "This job is already force-closed",
      });
    }

    const previousModeration = job.moderationStatus;
    const previousJobStatus = job.status;
    const previousReportStatus = report.status;
    const jobLabel = job.title || String(job._id);

    const reasons = new Set(
      Array.isArray(job.flagReasons) ? job.flagReasons.map(String) : []
    );
    reasons.add("user_report");
    job.flagReasons = [...reasons];
    job.status = "closed";
    job.isVerified = false;
    job.moderationStatus = "force_closed";
    job.closeReason = closeReason;
    job.moderatedAt = new Date();
    job.moderatedBy = req.userId;
    await job.save();

    report.status = "resolved";
    report.adminNote = adminNote;
    report.resolvedAt = new Date();
    report.moderatedBy = req.userId;
    await report.save();

    void recordAuditLog(req, {
      action: "job.force_close",
      targetType: "job",
      targetId: String(job._id),
      targetLabel: jobLabel,
      summary: `Force-closed job "${jobLabel}" from report`,
      before: { moderationStatus: previousModeration, status: previousJobStatus },
      after: {
        moderationStatus: job.moderationStatus,
        status: job.status,
      },
      note: adminNote,
    });

    void recordAuditLog(req, {
      action: "report.resolve",
      targetType: "report",
      targetId: String(report._id),
      targetLabel: report.targetLabel || jobLabel,
      summary: `Resolved report after force-closing job "${jobLabel}"`,
      before: { status: previousReportStatus },
      after: { status: "resolved" },
      note: adminNote,
    });

    return res.status(200).json({
      success: true,
      message: "Job force-closed and report resolved",
      report: formatReport(report),
      jobId: String(job._id),
    });
  } catch (error) {
    console.error("Force-close from report error:", error);
    return res.status(500).json({
      success: false,
      message: "Error force-closing job from report",
      error: error.message,
    });
  }
};
