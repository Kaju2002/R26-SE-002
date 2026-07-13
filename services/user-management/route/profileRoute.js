import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { uploadAvatar, uploadCv, uploadLogo } from "../config/multer.js";
import {
  getMyProfile,
  getPublicRecruiterProfile,
  updateBasicProfile,
  updateSummary,
  updateSkills,
  addWorkExperience,
  updateWorkExperience,
  deleteWorkExperience,
  addEducation,
  updateEducation,
  deleteEducation,
  addLanguage,
  updateLanguage,
  deleteLanguage,
  updateCompanyLogo,
  updateAvatar,
  uploadCv as uploadCvController,
  deleteCv,
} from "../controller/profileController.js";

const router = express.Router();

// All profile routes require authentication
router.use(authMiddleware);

// ============ CORE PROFILE ============
router.get("/me", getMyProfile);
router.get("/public/:userId", getPublicRecruiterProfile);
router.patch("/basic", updateBasicProfile);
router.patch("/summary", updateSummary);
router.put("/skills", updateSkills);

// ============ WORK EXPERIENCE ============
router.post("/work-experience", uploadLogo, addWorkExperience);
router.put("/work-experience/:itemId", uploadLogo, updateWorkExperience);
router.delete("/work-experience/:itemId", deleteWorkExperience);

// ============ EDUCATION ============
router.post("/education", uploadLogo, addEducation);
router.put("/education/:itemId", uploadLogo, updateEducation);
router.delete("/education/:itemId", deleteEducation);

// ============ LANGUAGES ============
router.post("/languages", uploadLogo, addLanguage);
router.put("/languages/:itemId", uploadLogo, updateLanguage);
router.delete("/languages/:itemId", deleteLanguage);

// ============ FILE UPLOADS ============
router.patch("/company/logo", uploadLogo, updateCompanyLogo);
router.patch("/avatar", uploadAvatar, updateAvatar);
router.post("/cv", uploadCv, uploadCvController);
router.delete("/cv/:cvId", deleteCv);

export default router;
