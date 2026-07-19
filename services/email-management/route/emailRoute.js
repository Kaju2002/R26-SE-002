import express from "express";
import {
  callback,
  connect,
  disconnect,
  getMessage,
  getStatus,
  listFolders,
  listMessages,
  sendEmail,
} from "../controller/emailController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/status", authMiddleware, getStatus);
router.get("/connect", authMiddleware, connect);
router.get("/callback", authMiddleware, callback);
router.get("/folders", authMiddleware, listFolders);
router.get("/messages", authMiddleware, listMessages);
router.get("/messages/:messageId", authMiddleware, getMessage);
router.post("/send", authMiddleware, sendEmail);
router.delete("/disconnect", authMiddleware, disconnect);

export default router;
