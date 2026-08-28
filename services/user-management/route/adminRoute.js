import express from "express";
import {
  listManagedUsers,
  updateManagedUserStatus,
} from "../controller/adminController.js";
import {
  listVerificationRequests,
  decideVerificationRequest,
} from "../controller/verificationController.js";
import {
  addSupportTicketMessage,
  assignSupportTicketToMe,
  getSupportTicket,
  listSupportTickets,
  updateSupportTicket,
} from "../controller/supportTicketController.js";
import { listAuditLogs } from "../controller/auditLogController.js";
import {
  authMiddleware,
  requireSuperAdmin,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authMiddleware, requireSuperAdmin);

router.get("/users", listManagedUsers);
router.patch("/users/:userId/status", updateManagedUserStatus);

router.get("/verification-requests", listVerificationRequests);
router.patch(
  "/verification-requests/:id/decision",
  decideVerificationRequest
);

router.get("/support-tickets", listSupportTickets);
router.post("/support-tickets/:id/assign-me", assignSupportTicketToMe);
router.post("/support-tickets/:id/messages", addSupportTicketMessage);
router.get("/support-tickets/:id", getSupportTicket);
router.patch("/support-tickets/:id", updateSupportTicket);

router.get("/audit-log", listAuditLogs);

export default router;
