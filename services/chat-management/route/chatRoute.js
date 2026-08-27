import { Router } from "express";
import { authMiddleware, requireSuperAdmin } from "../middleware/authMiddleware.js";
import {
  createConversation,
  listConversations,
  updateConversationSaved,
  updateConversationStatus,
} from "../controller/conversationController.js";
import {
  getMessages,
  sendMessage,
  markConversationRead,
  deleteMessage,
  clearConversation,
} from "../controller/messageController.js";
import { postInterviewReminder } from "../controller/internalController.js";
import {
  createChatReport,
  getChatReport,
  getMyChatReport,
  listChatReports,
  updateChatReportFeedback,
  updateChatReportStatus,
} from "../controller/chatReportController.js";
import { uploadChatAttachment } from "../config/multer.js";

const router = Router();

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

router.post("/internal/interview-reminder", postInterviewReminder);

router.get("/reports", authMiddleware, requireSuperAdmin, listChatReports);
router.get("/reports/:reportId", authMiddleware, requireSuperAdmin, getChatReport);
router.patch(
  "/reports/:reportId",
  authMiddleware,
  requireSuperAdmin,
  updateChatReportStatus
);
router.patch("/reports/:reportId/feedback", authMiddleware, updateChatReportFeedback);

router.get("/conversations", authMiddleware, listConversations);
router.post("/conversations", authMiddleware, createConversation);

router.get(
  "/conversations/:conversationId/messages",
  authMiddleware,
  getMessages
);

router.post(
  "/conversations/:conversationId/messages",
  authMiddleware,
  uploadChatAttachment,
  sendMessage
);

router.post(
  "/conversations/:conversationId/clear",
  authMiddleware,
  clearConversation
);

router.delete(
  "/conversations/:conversationId/messages/:messageId",
  authMiddleware,
  deleteMessage
);

router.patch(
  "/conversations/:conversationId/read",
  authMiddleware,
  markConversationRead
);

router.patch(
  "/conversations/:conversationId/status",
  authMiddleware,
  updateConversationStatus
);

router.patch(
  "/conversations/:conversationId/saved",
  authMiddleware,
  updateConversationSaved
);

router.post(
  "/conversations/:conversationId/reports",
  authMiddleware,
  createChatReport
);
router.get(
  "/conversations/:conversationId/reports/me",
  authMiddleware,
  getMyChatReport
);

export default router;
