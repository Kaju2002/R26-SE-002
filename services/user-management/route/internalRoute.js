import express from "express";
import { matchJobseekersBySkills } from "../controller/internalController.js";

const router = express.Router();

router.post("/jobseekers/match-skills", matchJobseekersBySkills);

export default router;
