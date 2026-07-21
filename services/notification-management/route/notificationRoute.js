import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import {
  clearNotifications,
  deleteNotification,
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../controller/notificationController.js";
import {
  registerPushToken,
  unregisterPushToken,
} from "../controller/pushTokenController.js";

const router = Router();

router.get("/", authMiddleware, listNotifications);
router.get("/unread-count", authMiddleware, getUnreadNotificationCount);
router.patch("/read-all", authMiddleware, markAllNotificationsRead);
router.post("/push-token", authMiddleware, registerPushToken);
router.delete("/push-token", authMiddleware, unregisterPushToken);
router.patch("/:id/read", authMiddleware, markNotificationRead);
router.delete("/", authMiddleware, clearNotifications);
router.delete("/:id", authMiddleware, deleteNotification);

export default router;
