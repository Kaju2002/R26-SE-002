import express from "express";
import {
  listManagedUsers,
  updateManagedUserStatus,
} from "../controller/adminController.js";
import {
  authMiddleware,
  requireSuperAdmin,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authMiddleware, requireSuperAdmin);

router.get("/users", listManagedUsers);
router.patch("/users/:userId/status", updateManagedUserStatus);

export default router;
