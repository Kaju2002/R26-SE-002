import express from "express";
import {
  listSuperadmins,
  matchJobseekersBySkills,
} from "../controller/internalController.js";

const router = express.Router();

router.post("/jobseekers/match-skills", matchJobseekersBySkills);
router.get("/superadmins", listSuperadmins);

export default router;
