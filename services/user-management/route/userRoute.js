import express from "express";
import {
  register,
  login,
  logout,
  verifyEmailOtp,
  resendVerificationOtp,
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

// ============ LOGOUT ROUTE ============
// POST /api/auth/logout (Protected - requires token)
router.post("/logout", authMiddleware, logout);

export default router;
