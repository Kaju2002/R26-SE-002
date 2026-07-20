import express from "express";
import {
  register,
  registerRecruiter,
  registerCompany,
  login,
  logout,
  verifyEmailOtp,
  resendVerificationOtp,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  resendResetOtp,
  getCurrentUser,
  updateNylasConnection,
  getNylasGrant,
} from "../controller/userController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// ============ REGISTER ROUTE ============
// POST /api/auth/register (jobseeker / mobile)
router.post("/register", register);

// POST /api/auth/register-recruiter (dashboard)
router.post("/register-recruiter", registerRecruiter);

// POST /api/auth/register-company (dashboard)
router.post("/register-company", registerCompany);

// ============ LOGIN ROUTE ============
// POST /api/auth/login
router.post("/login", login);

// ============ EMAIL VERIFICATION ROUTES ============
// POST /api/auth/verify-email
router.post("/verify-email", verifyEmailOtp);

// POST /api/auth/resend-verification-otp
router.post("/resend-verification-otp", resendVerificationOtp);

// ============ PASSWORD RESET ROUTES ============
// POST /api/auth/forgot-password
router.post("/forgot-password", forgotPassword);

// POST /api/auth/verify-reset-otp
router.post("/verify-reset-otp", verifyResetOtp);

// POST /api/auth/reset-password
router.post("/reset-password", resetPassword);

// POST /api/auth/resend-reset-otp
router.post("/resend-reset-otp", resendResetOtp);

// ============ SESSION ROUTE ============
// GET /api/auth/me (Protected - validates token + returns user)
router.get("/me", authMiddleware, getCurrentUser);

// ============ NYLAS CONNECTION ============
router.get("/nylas", authMiddleware, getNylasGrant);
router.patch("/nylas", authMiddleware, updateNylasConnection);

// ============ LOGOUT ROUTE ============
// POST /api/auth/logout (Protected - requires token)
router.post("/logout", authMiddleware, logout);

export default router;
