import Job, { JOB_MODES, JOB_TYPES, JOB_STATUSES } from "../model/jobModel.js";
import Application from "../model/applicationModel.js";
import SavedJob from "../model/savedJobModel.js";
import { getFileUrl, getUploadedFile } from "../utils/cloudinaryHelper.js";
import { formatJob, formatJobList, formatModeratedJob } from "../utils/jobFormatter.js";
import { normalizeJobCreateInput, normalizeJobUpdateInput } from "../utils/jobPayloadNormalizer.js";
import { EVENT_TYPES } from "../constants/eventTypes.js";
import { publishEvent } from "../utils/publishEvent.js";
import { createJobStatusMessage, runJobRiskGate, updateJobStatusMessage } from "../utils/jobRiskGate.js";
import {
  assertHomeWorkspaceAccess,
  getOrCreateHomeWorkspace,
  loadWorkspace,
  WorkspaceAccessError,
} from "../service/employerWorkspaceService.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const parseNumber = (value) => {
  if (value === undefined || value === null || value === "") return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
};

const parseStringArray = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const parseTypes = (query) => {
  const fromTypes = parseStringArray(query.types);
  if (fromTypes.length) return fromTypes;
  if (query.type?.trim()) return [query.type.trim()];
  return [];
};

const parsePagination = (query) => {
  const page = Math.max(parseNumber(query.page) || DEFAULT_PAGE, 1);
  const limit = Math.min(Math.max(parseNumber(query.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

const getSortOption = (sort) => {
  switch (sort) {
    case "alphabetical":
      return { title: 1 };
    case "highest_salary":
      return { salaryMax: -1 };
    case "ending_soon":
      return { endsAt: 1, postedAt: -1 };
    case "newly_posted":
    default:
      return { postedAt: -1 };
  }
};

const buildPublicListFilter = (query) => {
  const filter = { status: "active" };

  const q = query.q?.trim();
  if (q) {
    filter.$or = [
      { title: { $regex: q, $options: "i" } },
      { companyName: { $regex: q, $options: "i" } },
      { location: { $regex: q, $options: "i" } },
    ];
  }

  if (query.mode && JOB_MODES.includes(query.mode)) {
    filter.mode = query.mode;
  }

  const types = parseTypes(query).filter((type) => JOB_TYPES.includes(type));
  if (types.length) {
    filter.type = types.length === 1 ? types[0] : { $in: types };
  }

  if (query.location?.trim()) {
    filter.location = { $regex: query.location.trim(), $options: "i" };
  }

  const currency = String(query.currency || "").trim().toUpperCase();
  if (currency === "GHS" || currency === "GHC") {
    filter.salaryCurrency = { $in: ["GHS", "GHC", "GH¢", "GH₵"] };
  } else if (currency === "LKR" || currency === "USD") {
    filter.salaryCurrency = currency;
  }

  const salaryMin = parseNumber(query.salaryMin);
  const salaryMax = parseNumber(query.salaryMax);
  if (salaryMin !== undefined) {
    filter.salaryMax = { ...(filter.salaryMax || {}), $gte: salaryMin };
  }
  if (salaryMax !== undefined) {
    filter.salaryMin = { ...(filter.salaryMin || {}), $lte: salaryMax };
  }

  return filter;
};

const sendJob = (res, job, message, statusCode = 200) => {
  res.status(statusCode).json({
    success: true,
    message,
    job: formatJob(job),
  });
};

const isValidObjectId = (id) => /^[a-fA-F0-9]{24}$/.test(String(id));

const findOwnedJob = async (id, userId, res) => {
  if (!isValidObjectId(id)) {
    res.status(400).json({ success: false, message: "Invalid job id" });
    return null;
  }

  const job = await Job.findById(id);
  if (!job) {
    res.status(404).json({ success: false, message: "Job not found" });
    return null;
  }

  if (job.postedBy !== userId) {
    res.status(403).json({
      success: false,
      message: "You can only modify your own jobs",
    });
    return null;
  }

  return job;
};

const ensureJobBelongsToLogin = async (job, user) => {
  if (!job?.workspaceId) return job;
  await assertHomeWorkspaceAccess(job.workspaceId, user);
  return job;
};

// Temporary protected route to verify auth middleware + user-management integration.
export const authPing = async (req, res) => {
  res.status(200).json({
    success: true,
    message: "Authenticated via user-management",
    userId: req.userId,
    email: req.userEmail,
    user: req.user,
  });
};

const EMPLOYER_ACCOUNT_TYPES = new Set(["recruiter", "company"]);

const getPosterType = (user) => {
  const accountType = user?.accountType;
  if (accountType === "company" || accountType === "recruiter") {
    return accountType;
  }
  return null;
};

const getJobUploadUrls = (req) => ({
  logoUrl: getFileUrl(getUploadedFile(req, "logo")),
  posterUrl: getFileUrl(getUploadedFile(req, "poster")),
});

const publishJobCreatedEvent = async (job) => {
  if (!job || String(job.status) !== "active") return false;

  return publishEvent(EVENT_TYPES.JOB_CREATED, {
    jobId: String(job._id),
    jobTitle: job.title || "",
    companyName: job.companyName || "",
    companyLogo: job.companyLogo || null,
    workspaceId: job.workspaceId ? String(job.workspaceId) : null,
    skills: Array.isArray(job.skills) ? job.skills : [],
    postedBy: job.postedBy ? String(job.postedBy) : undefined,
    posterImage: job.posterImage || null,
    location: job.location || "",
    type: job.type || "",
    mode: job.mode || "",
  });
};

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
    prediction: job.riskCheck?.prediction || "unknown",
    fakeProbability: job.riskCheck?.fakeProbability ?? null,
    message: job.riskCheck?.message || "Job flagged for admin review.",
  });
};

const attachRiskDecision = (target, risk, decision) => {
  target.status = decision.status;
  target.isVerified = decision.isVerified;
  target.moderationStatus = decision.moderationStatus;
  target.flagReasons = decision.flagReasons;
  target.riskCheck = risk;
  target.flaggedAt = decision.moderationStatus === "flagged" ? risk.checkedAt : null;
  if (decision.moderationStatus !== "force_closed") {
    target.closeReason = null;
  }
};

// ============ CREATE JOB ============
export const createJob = async (req, res) => {
  try {
    const posterType = getPosterType(req.user);
    if (!posterType || !EMPLOYER_ACCOUNT_TYPES.has(posterType)) {
      return res.status(403).json({
        success: false,
        message: "Only recruiters and companies can post jobs",
      });
    }

    const homeWorkspace = await getOrCreateHomeWorkspace(req.user);
    const body = req.body ?? {};
    const requestedWorkspaceId = String(body.workspaceId || "").trim();
    if (
      requestedWorkspaceId &&
      requestedWorkspaceId !== String(homeWorkspace._id)
    ) {
      return res.status(403).json({
        success: false,
        message: "This workspace does not belong to this login",
      });
    }

    body.companyName = homeWorkspace.name;
    body.companyLogo = homeWorkspace.logo || body.companyLogo || null;

    const { logoUrl, posterUrl } = getJobUploadUrls(req);
    const normalized = normalizeJobCreateInput(body, logoUrl, posterUrl);

    if (!normalized.errors?.length) {
      if (!normalized.document) {
        return res.status(400).json({
          success: false,
          message: "Invalid job payload",
        });
      }

      const document = {
        ...normalized.document,
        posterType,
        workspaceId: String(homeWorkspace._id),
        companyName: homeWorkspace.name,
        companyLogo: homeWorkspace.logo || normalized.document.companyLogo || null,
        posterImage: posterUrl || normalized.document.posterImage || null,
        posterName: req.user?.fullName || "",
        posterEmail: req.user?.email || req.userEmail || "",
      };

      const { risk, decision } = await runJobRiskGate(
        document,
        normalized.document.status
      );
      attachRiskDecision(document, risk, decision);

      const job = await Job.create({
        ...document,
        postedBy: req.userId,
      });

      if (job.status === "active") {
        void publishJobCreatedEvent(job);
      }
      if (job.moderationStatus === "flagged") {
        void publishJobFlaggedEvent(job);
      }

      return sendJob(res, job, createJobStatusMessage(job.status), 201);
    }

    return res.status(400).json({
      success: false,
      message: normalized.errors[0],
      errors: normalized.errors,
    });
  } catch (error) {
    console.error("Create job error:", error);

    if (error instanceof WorkspaceAccessError) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: messages[0] || "Validation error",
        errors: messages,
      });
    }

    res.status(500).json({
      success: false,
      message: "Error creating job",
      error: error.message,
    });
  }
};

// ============ LIST JOBS ============
export const listJobs = async (req, res) => {
  try {
    const filter = buildPublicListFilter(req.query);
    const sort = getSortOption(req.query.sort);
    const { page, limit, skip } = parsePagination(req.query);

    const [jobs, total] = await Promise.all([
      Job.find(filter).sort(sort).skip(skip).limit(limit),
      Job.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      message: "Jobs fetched successfully",
      jobs: formatJobList(jobs),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    });
  } catch (error) {
    console.error("List jobs error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching jobs",
      error: error.message,
    });
  }
};

// ============ MY JOBS ============
export const getMyJobs = async (req, res) => {
  try {
    const homeWorkspace = await getOrCreateHomeWorkspace(req.user);
    const requestedWorkspaceId = String(
      req.get("X-Workspace-Id") || req.query.workspaceId || ""
    ).trim();
    if (requestedWorkspaceId) {
      await assertHomeWorkspaceAccess(requestedWorkspaceId, req.user);
    }

    const filter = { workspaceId: String(homeWorkspace._id) };

    if (req.query.status && JOB_STATUSES.includes(req.query.status)) {
      filter.status = req.query.status;
    }

    const q = req.query.q?.trim();
    if (q) {
      filter.$or = [
        { title: { $regex: q, $options: "i" } },
        { companyName: { $regex: q, $options: "i" } },
        { location: { $regex: q, $options: "i" } },
      ];
    }

    const sort = getSortOption(req.query.sort);
    const { page, limit, skip } = parsePagination(req.query);

    const [jobs, total] = await Promise.all([
      Job.find(filter).sort(sort).skip(skip).limit(limit),
      Job.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      message: "Your jobs fetched successfully",
      jobs: formatJobList(jobs),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    });
  } catch (error) {
    console.error("Get my jobs error:", error);
    if (error instanceof WorkspaceAccessError) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    res.status(500).json({
      success: false,
      message: "Error fetching your jobs",
      error: error.message,
    });
  }
};

// ============ JOBS BY RECRUITER ============
export const getJobsByRecruiter = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Recruiter user id is required",
      });
    }

    const filter = { postedBy: userId.trim() };

    if (req.query.status && JOB_STATUSES.includes(req.query.status)) {
      filter.status = req.query.status;
    } else {
      filter.status = "active";
    }

    const sort = getSortOption(req.query.sort);
    const { page, limit, skip } = parsePagination(req.query);

    const [jobs, total] = await Promise.all([
      Job.find(filter).sort(sort).skip(skip).limit(limit),
      Job.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      message: "Recruiter jobs fetched successfully",
      jobs: formatJobList(jobs),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    });
  } catch (error) {
    console.error("Get jobs by recruiter error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching recruiter jobs",
      error: error.message,
    });
  }
};

// ============ JOB DETAILS ============
export const getJobById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid job id",
      });
    }

    const job = await Job.findById(id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    const isOwner = req.userId && job.postedBy === req.userId;
    const isAdmin = req.user?.accountType === "superadmin";
    if (job.status !== "active" && !isOwner && !isAdmin) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    sendJob(res, job, "Job fetched successfully");
  } catch (error) {
    console.error("Get job by id error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching job",
      error: error.message,
    });
  }
};

// ============ UPDATE JOB ============
export const updateJob = async (req, res) => {
  try {
    const { id } = req.params;
    const job = await findOwnedJob(id, req.userId, res);
    if (!job) return;
    await ensureJobBelongsToLogin(job, req.user);

    const body = req.body ?? {};
    const posterType = job.posterType || getPosterType(req.user) || "recruiter";
    const suppliedWorkspaceId = Object.prototype.hasOwnProperty.call(
      body,
      "workspaceId"
    )
      ? String(body.workspaceId || "").trim()
      : null;

    if (
      suppliedWorkspaceId !== null &&
      suppliedWorkspaceId !== String(job.workspaceId || "")
    ) {
      return res.status(400).json({
        success: false,
        message: "A job cannot be transferred to another workspace",
      });
    }

    const workspace = job.workspaceId
      ? await loadWorkspace(job.workspaceId)
      : null;

    // Company posters cannot rename the employer brand on their jobs.
    if (workspace) {
      body.companyName = workspace.name;
      body.companyLogo = workspace.logo || null;
    } else if (posterType === "company") {
      delete body.companyName;
      if (req.user?.company?.name) {
        body.companyName = req.user.company.name;
      }
      if (req.user?.company?.logo) {
        body.companyLogo = req.user.company.logo;
      }
    }

    const { logoUrl, posterUrl } = getJobUploadUrls(req);
    const normalized = normalizeJobUpdateInput(body, logoUrl, job, posterUrl);

    if (normalized.errors?.length) {
      return res.status(400).json({
        success: false,
        message: normalized.errors[0],
        errors: normalized.errors,
      });
    }

    const previousStatus = job.status;
    const previousModeration = job.moderationStatus;
    Object.assign(job, normalized.patch);

    if (workspace) {
      job.companyName = workspace.name;
      job.companyLogo = workspace.logo || null;
    } else if (posterType === "company" && req.user?.company?.name) {
      job.companyName = req.user.company.name;
      if (req.user.company.logo) {
        job.companyLogo = req.user.company.logo;
      }
    }

    if (req.user?.fullName) job.posterName = req.user.fullName;
    if (req.user?.email) job.posterEmail = req.user.email;

    const requestedStatus = job.status;
    const shouldScan =
      requestedStatus === "active" ||
      requestedStatus === "pending_review" ||
      previousStatus === "pending_review" ||
      previousModeration === "flagged";

    if (shouldScan) {
      const { risk, decision } = await runJobRiskGate(job, requestedStatus);
      attachRiskDecision(job, risk, decision);
    }

    await job.save();

    if (previousStatus !== "active" && job.status === "active") {
      void publishJobCreatedEvent(job);
    }
    if (previousModeration !== "flagged" && job.moderationStatus === "flagged") {
      void publishJobFlaggedEvent(job);
    }

    sendJob(res, job, updateJobStatusMessage(job.status));
  } catch (error) {
    console.error("Update job error:", error);

    if (error instanceof WorkspaceAccessError) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: messages[0] || "Validation error",
        errors: messages,
      });
    }

    res.status(500).json({
      success: false,
      message: "Error updating job",
      error: error.message,
    });
  }
};

// ============ NOTIFY SKILL MATCHES (manual / Compass jobs) ============
export const notifyJobSkillMatches = async (req, res) => {
  try {
    const { id } = req.params;
    const job = await findOwnedJob(id, req.userId, res);
    if (!job) return;
    await ensureJobBelongsToLogin(job, req.user);

    if (job.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "Only active jobs can notify skill matches",
      });
    }

    const published = await publishJobCreatedEvent(job);
    return res.status(200).json({
      success: true,
      message: published
        ? "Skill-match notifications queued"
        : "Event not published (check RABBITMQ_URL)",
      published,
      jobId: String(job._id),
    });
  } catch (error) {
    console.error("Notify job skill matches error:", error);
    if (error instanceof WorkspaceAccessError) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    return res.status(500).json({
      success: false,
      message: "Error queueing skill-match notifications",
      error: error.message,
    });
  }
};

// ============ ADMIN MODERATION ============
export const listModerationJobs = async (req, res) => {
  try {
    const requested = String(req.query.moderationStatus || "").trim();
    const filter = {};
    if (["flagged", "cleared", "force_closed"].includes(requested)) {
      filter.moderationStatus = requested;
    } else {
      filter.moderationStatus = { $in: ["flagged", "cleared", "force_closed"] };
    }

    const q = req.query.q?.trim();
    if (q) {
      filter.$or = [
        { title: { $regex: q, $options: "i" } },
        { companyName: { $regex: q, $options: "i" } },
        { posterName: { $regex: q, $options: "i" } },
        { posterEmail: { $regex: q, $options: "i" } },
        { location: { $regex: q, $options: "i" } },
      ];
    }

    const { page, limit, skip } = parsePagination(req.query);
    const [jobs, total, flagged, cleared, forceClosed] = await Promise.all([
      Job.find(filter).sort({ flaggedAt: -1, postedAt: -1 }).skip(skip).limit(limit),
      Job.countDocuments(filter),
      Job.countDocuments({ moderationStatus: "flagged" }),
      Job.countDocuments({ moderationStatus: "cleared" }),
      Job.countDocuments({ moderationStatus: "force_closed" }),
    ]);

    res.status(200).json({
      success: true,
      message: "Moderation jobs fetched successfully",
      jobs: jobs.map((job) => formatModeratedJob(job)),
      counts: {
        total: flagged + cleared + forceClosed,
        flagged,
        cleared,
        forceClosed,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    });
  } catch (error) {
    console.error("List moderation jobs error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching jobs for moderation",
      error: error.message,
    });
  }
};

export const moderateJob = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid job id",
      });
    }

    const job = await Job.findById(id);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    const action = String(req.body?.action || "").trim().toLowerCase();
    if (action !== "approve" && action !== "reject") {
      return res.status(400).json({
        success: false,
        message: "Action must be approve or reject",
      });
    }

    if (job.moderationStatus !== "flagged") {
      return res.status(400).json({
        success: false,
        message: "Only flagged jobs can be moderated",
      });
    }

    if (action === "approve") {
      job.status = "active";
      job.isVerified = true;
      job.moderationStatus = "cleared";
      job.closeReason = null;
    } else {
      const closeReason = String(req.body?.closeReason || "").trim();
      if (!closeReason) {
        return res.status(400).json({
          success: false,
          message: "Add a force-close reason before rejecting this listing",
        });
      }
      job.status = "closed";
      job.isVerified = false;
      job.moderationStatus = "force_closed";
      job.closeReason = closeReason;
    }

    job.moderatedAt = new Date();
    job.moderatedBy = req.userId;
    await job.save();

    if (action === "approve") {
      void publishJobCreatedEvent(job);
    }

    res.status(200).json({
      success: true,
      message:
        action === "approve"
          ? "Job cleared and published to job seekers"
          : "Job force-closed and hidden from job seekers",
      job: formatModeratedJob(job),
    });
  } catch (error) {
    console.error("Moderate job error:", error);
    res.status(500).json({
      success: false,
      message: "Error moderating job",
      error: error.message,
    });
  }
};

// ============ DELETE JOB ============
export const deleteJob = async (req, res) => {
  try {
    const { id } = req.params;
    const job = await findOwnedJob(id, req.userId, res);
    if (!job) return;
    await ensureJobBelongsToLogin(job, req.user);

    await Promise.all([
      SavedJob.deleteMany({ jobId: job._id }),
      Application.deleteMany({ jobId: job._id }),
      Job.findByIdAndDelete(job._id),
    ]);

    res.status(200).json({
      success: true,
      message: "Job deleted successfully",
    });
  } catch (error) {
    console.error("Delete job error:", error);
    if (error instanceof WorkspaceAccessError) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    res.status(500).json({
      success: false,
      message: "Error deleting job",
      error: error.message,
    });
  }
};
