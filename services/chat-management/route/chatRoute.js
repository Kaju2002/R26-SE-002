import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { createConversation } from "../controller/conversationController.js";

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

/**
 * POST /api/chat/conversations
 * Create (or return) the conversation for a job application.
 */
router.post("/conversations", authMiddleware, createConversation);

export default router;
