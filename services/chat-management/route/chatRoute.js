import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import {
  createConversation,
  listConversations,
} from "../controller/conversationController.js";
import { getMessages, sendMessage } from "../controller/messageController.js";

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
 * GET /api/chat/conversations
 * List inbox conversations for the logged-in user.
 */
router.get("/conversations", authMiddleware, listConversations);

/**
 * POST /api/chat/conversations
 * Create (or return) the conversation for a job application.
 */
router.post("/conversations", authMiddleware, createConversation);

/**
 * GET /api/chat/conversations/:conversationId/messages
 * List messages in a conversation (participants only).
 */
router.get(
  "/conversations/:conversationId/messages",
  authMiddleware,
  getMessages
);

/**
 * POST /api/chat/conversations/:conversationId/messages
 * Send a text message in a conversation (participants only).
 */
router.post(
  "/conversations/:conversationId/messages",
  authMiddleware,
  sendMessage
);

export default router;
