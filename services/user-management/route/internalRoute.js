import express from "express";
import {
  listSuperadmins,
  matchJobseekersBySkills,
} from "../controller/internalController.js";
import { createAuditLogInternal } from "../controller/auditLogController.js";

const router = express.Router();

router.post("/jobseekers/match-skills", matchJobseekersBySkills);
router.get("/superadmins", listSuperadmins);
router.post("/audit-log", createAuditLogInternal);

export default router;
