import Conversation from "../model/conversationModel.js";
import { fetchWorkspace } from "./jobManagementClient.js";

export const isEmployerAccount = (accountType) =>
  accountType === "recruiter" || accountType === "company";

export const normalizeWorkspaceId = (value) =>
  String(value || "").trim();

export const getRequestWorkspaceId = (req) =>
  normalizeWorkspaceId(req.get("X-Workspace-Id"));

export const buildConversationEventContext = (conversation, access = {}) => ({
  recruiterId: conversation.recruiterId,
  jobseekerId: conversation.jobseekerId,
  workspaceId: conversation.workspaceId || null,
  workspaceMemberIds: (access.workspace?.members || [])
    .filter((member) => member.status === "active")
    .map((member) => String(member.userId)),
});

export const validateWorkspaceMembership = async ({
  workspaceId,
  authorizationHeader,
  cache,
}) => {
  const normalized = normalizeWorkspaceId(workspaceId);
  if (!normalized) {
    return {
      ok: false,
      status: 400,
      message: "X-Workspace-Id is required",
    };
  }

  if (cache?.has(normalized)) return cache.get(normalized);

  const result = await fetchWorkspace(normalized, authorizationHeader);
  cache?.set(normalized, result);
  return result;
};

export const authorizeConversation = async ({
  conversation,
  userId,
  accountType,
  workspaceId,
  authorizationHeader,
  membershipCache,
}) => {
  const callerId = String(userId);

  if (!isEmployerAccount(accountType)) {
    return String(conversation.jobseekerId) === callerId
      ? { ok: true, role: "jobseeker" }
      : {
          ok: false,
          status: 403,
          message: "You are not a participant of this conversation",
        };
  }

  const conversationWorkspaceId = normalizeWorkspaceId(
    conversation.workspaceId
  );
  if (!conversationWorkspaceId) {
    return String(conversation.recruiterId) === callerId
      ? { ok: true, role: "recruiter", legacy: true }
      : {
          ok: false,
          status: 403,
          message: "You are not a participant of this legacy conversation",
        };
  }

  const requestedWorkspaceId = normalizeWorkspaceId(workspaceId);
  if (!requestedWorkspaceId) {
    return {
      ok: false,
      status: 400,
      message: "X-Workspace-Id is required for workspace conversations",
    };
  }
  if (requestedWorkspaceId !== conversationWorkspaceId) {
    return {
      ok: false,
      status: 403,
      message: "Workspace does not match this conversation",
    };
  }

  const membership = await validateWorkspaceMembership({
    workspaceId: conversationWorkspaceId,
    authorizationHeader,
    cache: membershipCache,
  });
  if (!membership.ok) return membership;

  return { ok: true, role: "recruiter", workspace: membership.workspace };
};

export const getAuthorizedConversation = async ({
  conversationId,
  userId,
  accountType,
  workspaceId,
  authorizationHeader,
  membershipCache,
  projection,
}) => {
  if (!/^[a-fA-F0-9]{24}$/.test(String(conversationId))) {
    return { ok: false, status: 400, message: "Invalid conversation id" };
  }

  const query = Conversation.findById(conversationId);
  if (projection) query.select(projection);
  const conversation = await query;
  if (!conversation) {
    return { ok: false, status: 404, message: "Conversation not found" };
  }

  const access = await authorizeConversation({
    conversation,
    userId,
    accountType,
    workspaceId,
    authorizationHeader,
    membershipCache,
  });
  return access.ok ? { ...access, conversation } : access;
};
