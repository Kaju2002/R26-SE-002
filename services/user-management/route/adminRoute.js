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

export default router;
