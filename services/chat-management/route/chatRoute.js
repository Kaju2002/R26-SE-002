import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = Router();

/**
 * GET /api/chat/me
 * Test route: proves JWT auth works for chat-management.
 */
router.get("/me", authMiddleware, (req, res) => {
  res.status(200).json({
    success: true,
    message: "Chat session is valid",
    user: {
      id: req.userId,
      email: req.email,
      accountType: req.accountType,
    },
  });
});

export default router;
