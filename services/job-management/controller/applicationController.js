import Job from "../model/jobModel.js";
import Application from "../model/applicationModel.js";
import { getFileUrl } from "../utils/cloudinaryHelper.js";
import { formatApplication } from "../utils/applicationFormatter.js";

const isValidObjectId = (id) => /^[a-fA-F0-9]{24}$/.test(String(id));

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
    uploadedFile?.originalname?.trim() || body.resumeName?.trim() || "";

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
      applicantId: req.userId,
      fullName: payload.fullName,
      email: payload.email,
      motivation: payload.motivation,
      resumeUrl: payload.resumeUrl,
      resumeName: payload.resumeName,
      status: "sent",
    });

    await Job.findByIdAndUpdate(job._id, {
      $inc: { applicantsCount: 1 },
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
