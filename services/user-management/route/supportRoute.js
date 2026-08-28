import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import {
  addMySupportTicketMessage,
  createSupportTicket,
  getMySupportTicket,
  listMySupportTickets,
} from "../controller/supportTicketController.js";

const router = express.Router();

router.use(authMiddleware);

router.post("/tickets", createSupportTicket);
router.get("/tickets", listMySupportTickets);
router.get("/tickets/:id", getMySupportTicket);
router.post("/tickets/:id/messages", addMySupportTicketMessage);

export default router;
