import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import Conversation from "../model/conversationModel.js";
import Message from "../model/messageModel.js";
import {
  getAuthorizedConversation,
  isEmployerAccount,
  normalizeWorkspaceId,
  validateWorkspaceMembership,
} from "../utils/workspaceAuthorization.js";

const JWT_SECRET = () => process.env.JWT_SECRET || "greatStack";
const conversationRoom = (id) => `conversation:${id}`;
const userRoom = (userId) => `user:${String(userId)}`;
const workspaceUserRoom = (workspaceId, userId) =>
  `workspace:${workspaceId}:user:${String(userId)}`;
const onlineKey = (userId, workspaceId) =>
  workspaceId
    ? `workspace:${workspaceId}:user:${String(userId)}`
    : userRoom(userId);

let io = null;
const onlineSockets = new Map();
const lastSeen = new Map();

const addOnlineSocket = (key, socketId) => {
  const sockets = onlineSockets.get(key) ?? new Set();
  sockets.add(socketId);
  onlineSockets.set(key, sockets);
  return sockets.size;
};

const removeOnlineSocket = (key, socketId) => {
  const sockets = onlineSockets.get(key);
  if (!sockets) return 0;
  sockets.delete(socketId);
  if (!sockets.size) onlineSockets.delete(key);
  return sockets.size;
};

export const isUserOnline = (userId, workspaceId = null) =>
  (onlineSockets.get(onlineKey(userId, workspaceId))?.size ?? 0) > 0;

const presenceFor = (userId, workspaceId = null) => {
  const key = onlineKey(userId, workspaceId);
  return {
    userId: String(userId),
    workspaceId: workspaceId || null,
    isOnline: isUserOnline(userId, workspaceId),
    lastSeenAt: lastSeen.get(key) ?? null,
  };
};

const roomForConversationUser = (conversation, userId) => {
  const isJobseeker =
    String(conversation.jobseekerId) === String(userId);
  if (isJobseeker || !conversation.workspaceId) return userRoom(userId);
  return workspaceUserRoom(conversation.workspaceId, userId);
};

const conversationFilterForSocket = (socket) => {
  if (!isEmployerAccount(socket.accountType)) {
    return { jobseekerId: socket.userId };
  }
  if (socket.workspaceId) return { workspaceId: socket.workspaceId };
  return {
    recruiterId: socket.userId,
    $or: [
      { workspaceId: null },
      { workspaceId: "" },
      { workspaceId: { $exists: false } },
    ],
  };
};

const socketConversations = (socket) =>
  Conversation.find(conversationFilterForSocket(socket)).select(
    "_id recruiterId jobseekerId workspaceId"
  );

const assertSocketAccess = async (socket, payload = {}) => {
  const conversationId = String(payload.conversationId || "").trim();
  const result = await getAuthorizedConversation({
    conversationId,
    userId: socket.userId,
    accountType: socket.accountType,
    workspaceId: socket.workspaceId,
    authorizationHeader: socket.authorizationHeader,
    membershipCache: socket.workspaceMembershipCache,
    projection: "recruiterId jobseekerId workspaceId",
  });
  if (!result.ok) return result;

  const payloadWorkspaceId = normalizeWorkspaceId(payload.workspaceId);
  const conversationWorkspaceId = normalizeWorkspaceId(
    result.conversation.workspaceId
  );
  if (payloadWorkspaceId && payloadWorkspaceId !== conversationWorkspaceId) {
    return {
      ok: false,
      message: "Workspace does not match this conversation",
    };
  }
  return result;
};

const notifyPresenceToPeers = async (socket) => {
  if (!io) return;
  const conversations = await socketConversations(socket);
  const payload = presenceFor(socket.userId, socket.workspaceId);
  for (const conversation of conversations) {
    const isJobseeker =
      String(conversation.jobseekerId) === socket.userId;
    const peerId = isJobseeker
      ? conversation.recruiterId
      : conversation.jobseekerId;
    let target = io.to(roomForConversationUser(conversation, peerId));
    if (isJobseeker && conversation.workspaceId) {
      target = addEmployerWorkspaceTargets(target, conversation.workspaceId);
    }
    target.emit("presence:update", {
      ...payload,
      workspaceId: conversation.workspaceId || null,
    });
  }
};

const markPendingMessagesDelivered = async (socket) => {
  if (!io) return;
  const conversations = await socketConversations(socket);
  const deliveredAt = new Date();

  await Promise.all(
    conversations.map(async (conversation) => {
      const isEmployerSocket = isEmployerAccount(socket.accountType);
      const result = await Message.updateMany(
        {
          conversationId: conversation._id,
          senderId: isEmployerSocket
            ? String(conversation.jobseekerId)
            : { $ne: socket.userId },
          status: "sent",
          suppressedForPeer: { $ne: true },
        },
        { $set: { status: "delivered", deliveredAt } }
      );
      if (!result.modifiedCount) return;

      const senderId =
        String(conversation.jobseekerId) === socket.userId
          ? conversation.recruiterId
          : conversation.jobseekerId;
      const payload = {
        conversationId: String(conversation._id),
        workspaceId: conversation.workspaceId || null,
        recipientId: socket.userId,
        status: "delivered",
        deliveredAt,
      };
      addConversationTargets(
        io
          .to(conversationRoom(conversation._id))
          .to(roomForConversationUser(conversation, senderId)),
        conversation
      ).emit("messages:status", payload);
    })
  );
};

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  io.use(async (socket, next) => {
    try {
      const rawToken =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, "");
      if (!rawToken) return next(new Error("Authentication required"));

      const decoded = jwt.verify(rawToken, JWT_SECRET());
      if (!decoded.userId) return next(new Error("Invalid token payload"));

      socket.userId = String(decoded.userId);
      socket.email = decoded.email ?? null;
      socket.accountType = decoded.accountType || "jobseeker";
      socket.authorizationHeader = `Bearer ${rawToken}`;
      socket.workspaceMembershipCache = new Map();
      socket.workspaceId = isEmployerAccount(socket.accountType)
        ? normalizeWorkspaceId(socket.handshake.auth?.workspaceId) || null
        : null;

      if (socket.workspaceId) {
        const membership = await validateWorkspaceMembership({
          workspaceId: socket.workspaceId,
          authorizationHeader: socket.authorizationHeader,
          cache: socket.workspaceMembershipCache,
        });
        if (!membership.ok) return next(new Error(membership.message));
      }
      next();
    } catch {
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket) => {
    const personalRoom = socket.workspaceId
      ? workspaceUserRoom(socket.workspaceId, socket.userId)
      : userRoom(socket.userId);
    const key = onlineKey(socket.userId, socket.workspaceId);
    socket.join(personalRoom);

    if (addOnlineSocket(key, socket.id) === 1) {
      void notifyPresenceToPeers(socket);
      void markPendingMessagesDelivered(socket);
    }

    socket.on("conversation:join", async (payload = {}) => {
      try {
        const access = await assertSocketAccess(socket, payload);
        const conversationId = String(payload.conversationId || "").trim();
        if (!access.ok) {
          socket.emit("conversation:error", {
            conversationId,
            workspaceId: socket.workspaceId,
            message: access.message,
          });
          return;
        }

        const conversation = access.conversation;
        const peerId =
          String(conversation.jobseekerId) === socket.userId
            ? conversation.recruiterId
            : conversation.jobseekerId;
        const peerWorkspaceId =
          String(conversation.jobseekerId) === socket.userId
            ? conversation.workspaceId
            : null;

        socket.join(conversationRoom(conversationId));
        socket.emit("conversation:joined", {
          conversationId,
          workspaceId: conversation.workspaceId || null,
          peerPresence: presenceFor(peerId, peerWorkspaceId),
        });
      } catch (error) {
        socket.emit("conversation:error", {
          workspaceId: socket.workspaceId,
          message: "Could not join conversation",
        });
      }
    });

    socket.on("conversation:leave", async (payload = {}) => {
      try {
        const access = await assertSocketAccess(socket, payload);
        if (!access.ok) {
          socket.emit("conversation:error", {
            conversationId: String(payload.conversationId || ""),
            workspaceId: socket.workspaceId,
            message: access.message,
          });
          return;
        }
        const conversationId = String(payload.conversationId);
        socket.to(conversationRoom(conversationId)).emit("typing:update", {
          conversationId,
          workspaceId: access.conversation.workspaceId || null,
          userId: socket.userId,
          isTyping: false,
        });
        socket.leave(conversationRoom(conversationId));
      } catch (error) {
        console.error("Conversation leave error:", error.message);
      }
    });

    const emitTyping = async (payload = {}, isTyping) => {
      try {
        const access = await assertSocketAccess(socket, payload);
        if (!access.ok) {
          socket.emit("conversation:error", {
            conversationId: String(payload.conversationId || ""),
            workspaceId: socket.workspaceId,
            message: access.message,
          });
          return;
        }
        const conversationId = String(payload.conversationId);
        socket.to(conversationRoom(conversationId)).emit("typing:update", {
          conversationId,
          workspaceId: access.conversation.workspaceId || null,
          userId: socket.userId,
          isTyping: Boolean(isTyping),
        });
      } catch (error) {
        console.error("Typing event error:", error.message);
      }
    };

    socket.on("typing:start", (payload) => void emitTyping(payload, true));
    socket.on("typing:stop", (payload) => void emitTyping(payload, false));

    socket.on("disconnect", () => {
      if (removeOnlineSocket(key, socket.id) === 0) {
        lastSeen.set(key, new Date());
        void notifyPresenceToPeers(socket);
      }
    });
  });

  console.log("Socket.io ready (JWT + workspace authorization)");
  return io;
};

export const getIO = () => io;

const addConversationTargets = (target, conversation) => {
  if (!conversation) return target;
  target = target.to(userRoom(conversation.jobseekerId));
  if (!conversation.workspaceId) {
    return target.to(userRoom(conversation.recruiterId));
  }
  return addEmployerWorkspaceTargets(target, conversation.workspaceId).to(
    workspaceUserRoom(conversation.workspaceId, conversation.recruiterId)
  );
};

const addEmployerWorkspaceTargets = (target, workspaceId) => {
  const prefix = `workspace:${workspaceId}:user:`;
  for (const room of onlineSockets.keys()) {
    if (room.startsWith(prefix)) target = target.to(room);
  }
  return target;
};

const eventPayload = (conversationId, conversation, payload = {}) => ({
  conversationId: String(conversationId),
  ...payload,
  workspaceId: conversation?.workspaceId || null,
});

export const emitMessageStatus = (
  conversationId,
  payload,
  conversation
) => {
  if (!io) return;
  addConversationTargets(
    io.to(conversationRoom(conversationId)),
    conversation
  ).emit("messages:status", eventPayload(conversationId, conversation, payload));
};

export const emitNewMessage = (conversationId, chatMessage, conversation) => {
  if (!io) return;
  addConversationTargets(
    io.to(conversationRoom(conversationId)),
    conversation
  ).emit("message:new", {
    workspaceId: conversation?.workspaceId || null,
    chatMessage,
  });
};

export const emitMessageDeleted = (
  conversationId,
  payload,
  { mode, userId, conversation } = {}
) => {
  if (!io) return;
  const fullPayload = eventPayload(conversationId, conversation, {
    ...payload,
    mode,
  });
  if (mode === "me") {
    if (userId && conversation) {
      io.to(roomForConversationUser(conversation, userId)).emit(
        "message:deleted",
        fullPayload
      );
    }
    return;
  }
  addConversationTargets(
    io.to(conversationRoom(conversationId)),
    conversation
  ).emit("message:deleted", fullPayload);
};

export const emitConversationCleared = (
  conversationId,
  userId,
  payload = {},
  conversation
) => {
  if (!io || !userId || !conversation) return;
  io.to(roomForConversationUser(conversation, userId)).emit(
    "conversation:cleared",
    eventPayload(conversationId, conversation, payload)
  );
};

export const emitConversationStatus = (
  conversationId,
  payload = {},
  conversation
) => {
  if (!io) return;
  addConversationTargets(
    io.to(conversationRoom(conversationId)),
    conversation
  ).emit(
    "conversation:status",
    eventPayload(conversationId, conversation, payload)
  );
};
