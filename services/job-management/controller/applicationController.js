import Job from "../model/jobModel.js";
import Application, { APPLICATION_STATUSES } from "../model/applicationModel.js";
import { EVENT_TYPES } from "../constants/eventTypes.js";
import { getFileUrl } from "../utils/cloudinaryHelper.js";
import { formatApplication, formatApplicationList } from "../utils/applicationFormatter.js";
import { formatJob } from "../utils/jobFormatter.js";
import { publishEvent } from "../utils/publishEvent.js";
import { buildResumeDownloadUrl, resolveResumeFilename } from "../utils/resumeUrlHelper.js";
import {
  getOrCreateHomeWorkspace,
  WorkspaceAccessError,
} from "../service/employerWorkspaceService.js";

/** Statuses a recruiter can set via PATCH. */
const RECRUITER_UPDATABLE_STATUSES = [
  "applied",
  "screened",
  "shortlisted",
  "interview",
  "offered",
  "hired",
  "rejected",
  // Legacy aliases still accepted from older clients
  "pending",
  "accepted",
];

const isValidObjectId = (id) => /^[a-fA-F0-9]{24}$/.test(String(id));

const parsePagination = (query) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 50);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateApplyPayload = (body = {}, uploadedFile = null) => {
  const errors = [];
  const fullName = body.fullName?.trim() || "";
  const email = body.email?.trim() || "";
  const motivation = body.motivation?.trim() || "";
  const uploadedUrl = getFileUrl(uploadedFile);
  const resumeUrl =
    uploadedUrl || body.resumeUrl?.trim() || body.resume?.trim() || "";
  const resumeName =
    body.resumeName?.trim() || uploadedFile?.originalname?.trim() || "";

  if (!fullName) errors.push("Full name is required");
  if (!email) errors.push("Email is required");
  else if (!EMAIL_REGEX.test(email)) errors.push("Email is invalid");
  if (!resumeUrl) errors.push("Resume is required");

  return {
    errors,
    fullName,
    email,
    motivation,
    resumeUrl,
    resumeName,
  };
};

// ============ APPLY TO JOB ============
export const applyToJob = async (req, res) => {
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

    if (job.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "Applications are only accepted for active jobs",
      });
    }

    if (job.postedBy === req.userId) {
      return res.status(400).json({
        success: false,
        message: "You cannot apply to your own job posting",
      });
    }

    const payload = validateApplyPayload(req.body ?? {}, req.file);
    if (payload.errors.length) {
      return res.status(400).json({
        success: false,
        message: payload.errors[0],
        errors: payload.errors,
      });
    }

    const existing = await Application.findOne({
      jobId: job._id,
      applicantId: req.userId,
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "You have already applied to this job",
        application: formatApplication(existing, job),
      });
    }

    const application = await Application.create({
      jobId: job._id,
      workspaceId: job.workspaceId || null,
      applicantId: req.userId,
      fullName: payload.fullName,
      email: payload.email,
      motivation: payload.motivation,
      resumeUrl: payload.resumeUrl,
      resumeName: payload.resumeName,
      status: "applied",
    });

    await Job.findByIdAndUpdate(job._id, {
      $inc: { applicantsCount: 1 },
    });

    await publishEvent(EVENT_TYPES.APPLICATION_CREATED, {
      applicationId: String(application._id),
      applicantId: req.userId,
      recruiterId: job.postedBy,
      jobId: String(job._id),
      workspaceId: job.workspaceId ? String(job.workspaceId) : null,
      jobTitle: job.title,
      companyName: job.companyName,
      companyLogo: job.companyLogo || null,
      applicantEmail: payload.email,
      applicantName: payload.fullName,
      companyWebsite: job.contact?.website?.trim() || "",
      hrEmail: job.contact?.email?.trim() || "",
      status: application.status,
    });

    res.status(201).json({
      success: true,
      message: "Application submitted successfully",
      application: formatApplication(application, job),
    });
  } catch (error) {
    console.error("Apply to job error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "You have already applied to this job",
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
      message: "Error submitting application",
      error: error.message,
    });
  }
};

// ============ GET APPLIED JOBS ============
export const getAppliedJobs = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);

    const [applications, total] = await Promise.all([
      Application.find({ applicantId: req.userId })
        .sort({ appliedAt: -1 })
        .skip(skip)
        .limit(limit),
      Application.countDocuments({ applicantId: req.userId }),
    ]);

    const jobIds = applications.map((entry) => entry.jobId);
    const jobs = await Job.find({ _id: { $in: jobIds } });
    const jobsById = Object.fromEntries(jobs.map((job) => [String(job._id), job]));

    const orderedJobs = applications
      .map((application) => {
        const job = jobsById[String(application.jobId)];
        if (!job) return null;
        return formatJob(job, { applicationStatus: application.status });
      })
      .filter(Boolean);

    res.status(200).json({
      success: true,
      message: "Applied jobs fetched successfully",
      jobs: orderedJobs,
      applications: formatApplicationList(applications, jobsById),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    });
  } catch (error) {
    console.error("Get applied jobs error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching applied jobs",
      error: error.message,
    });
  }
};

// ============ GET APPLICATIONS FOR A JOB (RECRUITER) ============
export const getJobApplications = async (req, res) => {
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

    if (String(job.postedBy) !== String(req.userId)) {
      return res.status(403).json({
        success: false,
        message: "Only the job owner can view applications for this job",
      });
    }

    if (job.workspaceId) {
      const home = await getOrCreateHomeWorkspace(req.user);
      if (String(job.workspaceId) !== String(home._id)) {
        return res.status(403).json({
          success: false,
          message: "This workspace does not belong to this login",
        });
      }
    }

    const { page, limit, skip } = parsePagination(req.query);
    const statusFilter = String(req.query.status || "").trim();
    const filter = { jobId: job._id };

    if (statusFilter) {
      if (!APPLICATION_STATUSES.includes(statusFilter)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Use one of: ${APPLICATION_STATUSES.join(", ")}`,
        });
      }
      filter.status = statusFilter;
    }

    const [applications, total] = await Promise.all([
      Application.find(filter).sort({ appliedAt: -1 }).skip(skip).limit(limit),
      Application.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Job applications fetched successfully",
      job: {
        id: String(job._id),
        workspaceId: job.workspaceId ? String(job.workspaceId) : null,
        title: job.title,
        companyName: job.companyName,
      },
      applications: formatApplicationList(applications, {
        [String(job._id)]: job,
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    });
  } catch (error) {
    console.error("Get job applications error:", error);
    if (error instanceof WorkspaceAccessError) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    return res.status(500).json({
      success: false,
      message: "Error fetching job applications",
      error: error.message,
    });
  }
};

// ============ GET SINGLE APPLICATION (OWNER OR APPLICANT) ============
// Used by chat-management to validate a conversation before creating it.
export const getApplicationById = async (req, res) => {
  try {
    const { applicationId } = req.params;

    if (!isValidObjectId(applicationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid application id",
      });
    }

    const application = await Application.findById(applicationId);
    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    const job = await Job.findById(application.jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found for this application",
      });
    }

    const recruiterId = String(job.postedBy);
    const applicantId = String(application.applicantId);
    const isJobOwner = recruiterId === String(req.userId);
    const isApplicant = applicantId === String(req.userId);

    if (!isJobOwner && !isApplicant) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to view this application",
      });
    }

    if (isJobOwner) {
      const home = await getOrCreateHomeWorkspace(req.user);
      const applicationWorkspaceId = application.workspaceId || job.workspaceId;
      if (
        applicationWorkspaceId &&
        String(applicationWorkspaceId) !== String(home._id)
      ) {
        return res.status(403).json({
          success: false,
          message: "This workspace does not belong to this login",
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Application fetched successfully",
      application: {
        id: String(application._id),
        applicantId,
        recruiterId,
        jobId: String(job._id),
        workspaceId: application.workspaceId
          ? String(application.workspaceId)
          : job.workspaceId
            ? String(job.workspaceId)
            : null,
        jobTitle: job.title,
        companyName: job.companyName,
        companyLogo: job.companyLogo || null,
        status: application.status,
        applicantName: application.fullName,
        applicantEmail: application.email,
      },
    });
  } catch (error) {
    console.error("Get application by id error:", error);
    if (error instanceof WorkspaceAccessError) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    return res.status(500).json({
      success: false,
      message: "Error fetching application",
      error: error.message,
    });
  }
};

// ============ UPDATE APPLICATION STATUS (RECRUITER) ============
export const updateApplicationStatus = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const status = String(req.body?.status || "").trim();

    if (!isValidObjectId(applicationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid application id",
      });
    }

    if (!RECRUITER_UPDATABLE_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Use one of: ${RECRUITER_UPDATABLE_STATUSES.join(", ")}`,
      });
    }

    const application = await Application.findById(applicationId);
    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    const job = await Job.findById(application.jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found for this application",
      });
    }

    if (String(job.postedBy) !== String(req.userId)) {
      return res.status(403).json({
        success: false,
        message: "Only the job owner can update application status",
      });
    }

    if (job.workspaceId) {
      const home = await getOrCreateHomeWorkspace(req.user);
      if (String(job.workspaceId) !== String(home._id)) {
        return res.status(403).json({
          success: false,
          message: "This workspace does not belong to this login",
        });
      }
    }

    if (application.status === status) {
      return res.status(200).json({
        success: true,
        message: "Application status unchanged",
        application: formatApplication(application, job),
      });
    }

    application.status = status;
    await application.save();

    await publishEvent(EVENT_TYPES.APPLICATION_STATUS_UPDATED, {
      applicationId: String(application._id),
      applicantId: application.applicantId,
      recruiterId: job.postedBy,
      jobId: String(job._id),
      workspaceId: application.workspaceId
        ? String(application.workspaceId)
        : job.workspaceId
          ? String(job.workspaceId)
          : null,
      jobTitle: job.title,
      companyName: job.companyName,
      companyLogo: job.companyLogo || null,
      applicantEmail: application.email || "",
      applicantName: application.fullName || "",
      companyWebsite: job.contact?.website?.trim() || "",
      hrEmail: job.contact?.email?.trim() || "",
      status: application.status,
    });

    return res.status(200).json({
      success: true,
      message: "Application status updated successfully",
      application: formatApplication(application, job),
    });
  } catch (error) {
    console.error("Update application status error:", error);

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

    return res.status(500).json({
      success: false,
      message: "Error updating application status",
      error: error.message,
    });
  }
};

// ============ DOWNLOAD APPLICATION RESUME ============
export const downloadApplicationResume = async (req, res) => {
  try {
    const { applicationId } = req.params;

    if (!isValidObjectId(applicationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid application id",
      });
    }

    const application = await Application.findById(applicationId);
    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    if (!application.resumeUrl) {
      return res.status(404).json({
        success: false,
        message: "Resume not found for this application",
      });
    }

    const job = await Job.findById(application.jobId);
    const isApplicant = application.applicantId === req.userId;
    const isJobOwner = job?.postedBy === req.userId;

    if (!isApplicant && !isJobOwner) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to download this resume",
      });
    }

    if (isJobOwner && job?.workspaceId) {
      const home = await getOrCreateHomeWorkspace(req.user);
      if (String(job.workspaceId) !== String(home._id)) {
        return res.status(403).json({
          success: false,
          message: "This workspace does not belong to this login",
        });
      }
    }

    const downloadUrl = buildResumeDownloadUrl(
      application.resumeUrl,
      application.resumeName
    );
    const filename = resolveResumeFilename(
      application.resumeName,
      application.resumeUrl
    );

    const fileResponse = await fetch(downloadUrl);
    if (!fileResponse.ok) {
      return res.status(502).json({
        success: false,
        message: "Could not fetch resume from storage",
      });
    }

    const contentType =
      fileResponse.headers.get("content-type") || "application/octet-stream";

    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`
    );

    const buffer = Buffer.from(await fileResponse.arrayBuffer());
    return res.status(200).send(buffer);
  } catch (error) {
    console.error("Download application resume error:", error);
    if (error instanceof WorkspaceAccessError) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    res.status(500).json({
      success: false,
      message: "Error downloading resume",
      error: error.message,
    });
  }
};
