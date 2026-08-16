import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import {
  createConversation,
  listConversations,
  updateConversationStatus,
} from "../controller/conversationController.js";
import { getMessages, sendMessage, markConversationRead, deleteMessage, clearConversation } from "../controller/messageController.js";
import { uploadChatAttachment } from "../config/multer.js";

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
 * Send text JSON or one multipart attachment (field: image or document).
 */
router.post(
  "/conversations/:conversationId/messages",
  authMiddleware,
  uploadChatAttachment,
  sendMessage
);

/**
 * POST /api/chat/conversations/:conversationId/clear
 * Clear all chat for the caller only (peer unchanged).
 */
router.post(
  "/conversations/:conversationId/clear",
  authMiddleware,
  clearConversation
);

/**
 * DELETE /api/chat/conversations/:conversationId/messages/:messageId
 * Body: { mode: "me" | "everyone" }
 * - me: delete for caller only
 * - everyone: sender deletes for both sides
 */
router.delete(
  "/conversations/:conversationId/messages/:messageId",
  authMiddleware,
  deleteMessage
);

/**
 * PATCH /api/chat/conversations/:conversationId/read
 * Mark conversation as read for the caller (clears unread badge).
 */
router.patch(
  "/conversations/:conversationId/read",
  authMiddleware,
  markConversationRead
);

/**
 * PATCH /api/chat/conversations/:conversationId/status
 * Body: { status: "active" | "archived" | "blocked" }
 * Archive, unarchive, block, or unblock a conversation (participants only).
 */
router.patch(
  "/conversations/:conversationId/status",
  authMiddleware,
  updateConversationStatus
);

export default router;
