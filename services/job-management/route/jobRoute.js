import express from "express";
import {
  authMiddleware,
  optionalAuthMiddleware,
  requireSuperAdmin,
} from "../middleware/authMiddleware.js";
import { optionalJobLogoUpload } from "../middleware/optionalJobLogoUpload.js";
import { optionalResumeUpload } from "../middleware/optionalResumeUpload.js";
import {
  applyToJob,
  downloadApplicationResume,
  getAppliedJobs,
  getApplicationById,
  getJobApplications,
  updateApplicationStatus,
} from "../controller/applicationController.js";
import {
  authPing,
  createJob,
  deleteJob,
  getJobById,
  getJobsByRecruiter,
  getMyJobs,
  listJobs,
  listModerationJobs,
  moderateJob,
  notifyJobSkillMatches,
  updateJob,
} from "../controller/jobController.js";
import {
  getSavedJobs,
  saveJob,
  unsaveJob,
} from "../controller/savedJobController.js";
import {
  cancelInterview,
  createInterview,
  getInterview,
  listInterviews,
  runInterviewRemindersNow,
  updateInterview,
} from "../controller/interviewController.js";
import {
  getMyWorkspace,
  listMyWorkspaces,
} from "../controller/employerWorkspaceController.js";

const router = express.Router();

// Specific paths before /:id
router.get("/me/ping", authMiddleware, authPing);
router.get("/mine", authMiddleware, getMyJobs);
router.get("/moderation", authMiddleware, requireSuperAdmin, listModerationJobs);
router.patch(
  "/:id/moderation",
  authMiddleware,
  requireSuperAdmin,
  moderateJob
);
router.get("/workspaces", authMiddleware, listMyWorkspaces);
router.get("/workspaces/:workspaceId", authMiddleware, getMyWorkspace);
router.get("/saved", authMiddleware, getSavedJobs);
router.get("/applied", authMiddleware, getAppliedJobs);
router.get("/interviews", authMiddleware, listInterviews);
router.post("/interviews", authMiddleware, createInterview);
router.post("/interviews/reminders/run", authMiddleware, runInterviewRemindersNow);
router.get("/interviews/:interviewId", authMiddleware, getInterview);
router.patch("/interviews/:interviewId", authMiddleware, updateInterview);
router.post("/interviews/:interviewId/cancel", authMiddleware, cancelInterview);
router.get("/recruiter/:userId", optionalAuthMiddleware, getJobsByRecruiter);
router.get(
  "/applications/:applicationId/resume",
  authMiddleware,
  downloadApplicationResume
);
router.get("/applications/:applicationId", authMiddleware, getApplicationById);
router.patch(
  "/applications/:applicationId/status",
  authMiddleware,
  updateApplicationStatus
);
router.post("/saved", authMiddleware, saveJob);
router.delete("/saved/:jobId", authMiddleware, unsaveJob);

router.get("/", optionalAuthMiddleware, listJobs);
router.post("/", authMiddleware, optionalJobLogoUpload, createJob);

router.get("/:id/applications", authMiddleware, getJobApplications);
router.post("/:id/apply", authMiddleware, optionalResumeUpload, applyToJob);
router.post("/:id/notify-matches", authMiddleware, notifyJobSkillMatches);
router.get("/:id", optionalAuthMiddleware, getJobById);
router.put("/:id", authMiddleware, optionalJobLogoUpload, updateJob);
router.delete("/:id", authMiddleware, deleteJob);

export default router;
