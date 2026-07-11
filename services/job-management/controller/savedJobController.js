import Job from "../model/jobModel.js";
import SavedJob from "../model/savedJobModel.js";
import { formatJobList } from "../utils/jobFormatter.js";

const isValidObjectId = (id) => /^[a-fA-F0-9]{24}$/.test(String(id));

const parsePagination = (query) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 50);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

// ============ GET SAVED JOBS ============
export const getSavedJobs = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);

    const [savedEntries, total] = await Promise.all([
      SavedJob.find({ userId: req.userId })
        .sort({ savedAt: -1 })
        .skip(skip)
        .limit(limit),
      SavedJob.countDocuments({ userId: req.userId }),
    ]);

    const jobIds = savedEntries.map((entry) => entry.jobId);
    const jobs = await Job.find({ _id: { $in: jobIds } });
    const jobsById = Object.fromEntries(jobs.map((job) => [String(job._id), job]));

    const orderedJobs = savedEntries
      .map((entry) => jobsById[String(entry.jobId)])
      .filter(Boolean);

    res.status(200).json({
      success: true,
      message: "Saved jobs fetched successfully",
      jobs: formatJobList(orderedJobs),
      savedJobIds: savedEntries.map((entry) => String(entry.jobId)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    });
  } catch (error) {
    console.error("Get saved jobs error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching saved jobs",
      error: error.message,
    });
  }
};

// ============ SAVE JOB ============
export const saveJob = async (req, res) => {
  try {
    const jobId = req.body?.jobId?.trim();

    if (!isValidObjectId(jobId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid job id",
      });
    }

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    const existing = await SavedJob.findOne({ userId: req.userId, jobId });
    if (existing) {
      return res.status(200).json({
        success: true,
        message: "Job already saved",
        jobId,
      });
    }

    await SavedJob.create({
      userId: req.userId,
      jobId,
    });

    res.status(201).json({
      success: true,
      message: "Job saved successfully",
      jobId,
    });
  } catch (error) {
    console.error("Save job error:", error);

    if (error.code === 11000) {
      return res.status(200).json({
        success: true,
        message: "Job already saved",
        jobId: req.body?.jobId,
      });
    }

    res.status(500).json({
      success: false,
      message: "Error saving job",
      error: error.message,
    });
  }
};

// ============ UNSAVE JOB ============
export const unsaveJob = async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!isValidObjectId(jobId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid job id",
      });
    }

    const result = await SavedJob.findOneAndDelete({ userId: req.userId, jobId });

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Saved job not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Job removed from saved list",
      jobId,
    });
  } catch (error) {
    console.error("Unsave job error:", error);
    res.status(500).json({
      success: false,
      message: "Error removing saved job",
      error: error.message,
    });
  }
};
