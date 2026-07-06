import express from "express";
import {
  register,
  login,
  logout,
  verifyEmailOtp,
  resendVerificationOtp,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  resendResetOtp,
  getCurrentUser,
} from "../controller/userController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// ============ REGISTER ROUTE ============
// POST /api/auth/register
router.post("/register", register);

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

// ============ LOGOUT ROUTE ============
// POST /api/auth/logout (Protected - requires token)
router.post("/logout", authMiddleware, logout);

export default router;
