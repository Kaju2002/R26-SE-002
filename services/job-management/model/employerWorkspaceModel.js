import { randomUUID } from "node:crypto";
import mongoose from "mongoose";

const WORKSPACE_STATUSES = ["active", "inactive"];
const MEMBER_ROLES = ["owner", "admin", "recruiter", "viewer"];
const MEMBER_STATUSES = ["active", "inactive"];

const memberSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: [true, "Workspace member user id is required"],
      trim: true,
    },
    role: {
      type: String,
      enum: MEMBER_ROLES,
      required: true,
    },
    status: {
      type: String,
      enum: MEMBER_STATUSES,
      default: "active",
    },
  },
  { _id: false }
);

const employerWorkspaceSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => randomUUID(),
      immutable: true,
    },
    ownerId: {
      type: String,
      required: [true, "Workspace owner id is required"],
      trim: true,
      immutable: true,
    },
    name: {
      type: String,
      required: [true, "Workspace name is required"],
      trim: true,
    },
    normalizedName: {
      type: String,
      required: [true, "Normalized workspace name is required"],
      trim: true,
      immutable: true,
    },
    logo: {
      type: String,
      default: null,
      trim: true,
    },
    status: {
      type: String,
      enum: WORKSPACE_STATUSES,
      default: "active",
      index: true,
    },
    members: {
      type: [memberSchema],
      default: [],
    },
  },
  { timestamps: true }
);

employerWorkspaceSchema.index(
  { ownerId: 1, normalizedName: 1 },
  { unique: true }
);
employerWorkspaceSchema.index({ "members.userId": 1, status: 1 });

const EmployerWorkspace = mongoose.model(
  "EmployerWorkspace",
  employerWorkspaceSchema
);

export default EmployerWorkspace;
export { MEMBER_ROLES, MEMBER_STATUSES, WORKSPACE_STATUSES };
