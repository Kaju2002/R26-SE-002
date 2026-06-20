import express from "express";
import { register, login, logout } from "../controller/userController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// ============ REGISTER ROUTE ============
// POST /api/auth/register
router.post("/register", register);

// ============ LOGIN ROUTE ============
// POST /api/auth/login
router.post("/login", login);

// ============ LOGOUT ROUTE ============
// POST /api/auth/logout (Protected - requires token)
router.post("/logout", authMiddleware, logout);

export default router;
