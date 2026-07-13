import express from "express";
import {
  authMiddleware,
  optionalAuthMiddleware,
} from "../middleware/authMiddleware.js";
import { optionalJobLogoUpload } from "../middleware/optionalJobLogoUpload.js";
import { optionalResumeUpload } from "../middleware/optionalResumeUpload.js";
import { applyToJob, downloadApplicationResume, getAppliedJobs } from "../controller/applicationController.js";
import {
  authPing,
  createJob,
  deleteJob,
  getJobById,
  getJobsByRecruiter,
  getMyJobs,
  listJobs,
  updateJob,
} from "../controller/jobController.js";
import {
  getSavedJobs,
  saveJob,
  unsaveJob,
} from "../controller/savedJobController.js";

const router = express.Router();

// Specific paths before /:id
router.get("/me/ping", authMiddleware, authPing);
router.get("/mine", authMiddleware, getMyJobs);
router.get("/saved", authMiddleware, getSavedJobs);
router.get("/applied", authMiddleware, getAppliedJobs);
router.get("/recruiter/:userId", optionalAuthMiddleware, getJobsByRecruiter);
router.get(
  "/applications/:applicationId/resume",
  authMiddleware,
  downloadApplicationResume
);
router.post("/saved", authMiddleware, saveJob);
router.delete("/saved/:jobId", authMiddleware, unsaveJob);

router.get("/", optionalAuthMiddleware, listJobs);
router.post("/", authMiddleware, optionalJobLogoUpload, createJob);

router.post("/:id/apply", authMiddleware, optionalResumeUpload, applyToJob);
router.get("/:id", optionalAuthMiddleware, getJobById);
router.put("/:id", authMiddleware, optionalJobLogoUpload, updateJob);
router.delete("/:id", authMiddleware, deleteJob);

export default router;
