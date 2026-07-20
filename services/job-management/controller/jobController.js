import Job, { JOB_MODES, JOB_TYPES, JOB_STATUSES } from "../model/jobModel.js";
import Application from "../model/applicationModel.js";
import SavedJob from "../model/savedJobModel.js";
import { getFileUrl } from "../utils/cloudinaryHelper.js";
import { formatJob, formatJobList } from "../utils/jobFormatter.js";
import { normalizeJobCreateInput, normalizeJobUpdateInput } from "../utils/jobPayloadNormalizer.js";

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

const applyCompanyBranding = (document, user) => {
  const companyName = user?.company?.name?.trim();
  if (!companyName) {
    return {
      ok: false,
      message: "Company profile name is required before posting jobs",
    };
  }

  return {
    ok: true,
    document: {
      ...document,
      companyName,
      companyLogo: user?.company?.logo || document.companyLogo || null,
    },
  };
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

    const body = req.body ?? {};
    // Company accounts: inject locked company name before validation.
    if (posterType === "company") {
      const companyName = req.user?.company?.name?.trim();
      if (!companyName) {
        return res.status(400).json({
          success: false,
          message: "Company profile name is required before posting jobs",
        });
      }
      body.companyName = companyName;
      if (req.user?.company?.logo) {
        body.companyLogo = req.user.company.logo;
      }
    }

    const normalized = normalizeJobCreateInput(body, getFileUrl(req.file));

    if (!normalized.errors?.length) {
      if (!normalized.document) {
        return res.status(400).json({
          success: false,
          message: "Invalid job payload",
        });
      }

      let document = {
        ...normalized.document,
        posterType,
      };

      if (posterType === "company") {
        const branded = applyCompanyBranding(document, req.user);
        if (!branded.ok) {
          return res.status(400).json({
            success: false,
            message: branded.message,
          });
        }
        document = branded.document;
      }

      const job = await Job.create({
        ...document,
        postedBy: req.userId,
      });

      const message =
        document.status === "draft"
          ? "Job submitted for review"
          : "Job created successfully";

      return sendJob(res, job, message, 201);
    }

    return res.status(400).json({
      success: false,
      message: normalized.errors[0],
      errors: normalized.errors,
    });
  } catch (error) {
    console.error("Create job error:", error);

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
    const filter = { postedBy: req.userId };

    if (req.query.status && JOB_STATUSES.includes(req.query.status)) {
      filter.status = req.query.status;
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
    if (job.status !== "active" && !isOwner) {
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

    const body = req.body ?? {};
    const posterType = job.posterType || getPosterType(req.user) || "recruiter";

    // Company posters cannot rename the employer brand on their jobs.
    if (posterType === "company") {
      delete body.companyName;
      if (req.user?.company?.name) {
        body.companyName = req.user.company.name;
      }
      if (req.user?.company?.logo) {
        body.companyLogo = req.user.company.logo;
      }
    }

    const normalized = normalizeJobUpdateInput(body, getFileUrl(req.file), job);

    if (normalized.errors?.length) {
      return res.status(400).json({
        success: false,
        message: normalized.errors[0],
        errors: normalized.errors,
      });
    }

    Object.assign(job, normalized.patch);

    if (posterType === "company" && req.user?.company?.name) {
      job.companyName = req.user.company.name;
      if (req.user.company.logo) {
        job.companyLogo = req.user.company.logo;
      }
    }

    await job.save();

    sendJob(res, job, "Job updated successfully");
  } catch (error) {
    console.error("Update job error:", error);

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

// ============ DELETE JOB ============
export const deleteJob = async (req, res) => {
  try {
    const { id } = req.params;
    const job = await findOwnedJob(id, req.userId, res);
    if (!job) return;

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
    res.status(500).json({
      success: false,
      message: "Error deleting job",
      error: error.message,
    });
  }
};
