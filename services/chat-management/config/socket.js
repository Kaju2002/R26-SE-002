import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import Conversation from "../model/conversationModel.js";
import Message from "../model/messageModel.js";

const JWT_SECRET = () => process.env.JWT_SECRET || "greatStack";
const isValidObjectId = (id) => /^[a-fA-F0-9]{24}$/.test(String(id));

let io = null;
const onlineSocketsByUser = new Map();
const lastSeenByUser = new Map();

const conversationRoom = (conversationId) => `conversation:${conversationId}`;
const userRoom = (userId) => `user:${String(userId)}`;

const addOnlineSocket = (userId, socketId) => {
  const sockets = onlineSocketsByUser.get(userId) ?? new Set();
  sockets.add(socketId);
  onlineSocketsByUser.set(userId, sockets);
  return sockets.size;
};

const removeOnlineSocket = (userId, socketId) => {
  const sockets = onlineSocketsByUser.get(userId);
  if (!sockets) return 0;
  sockets.delete(socketId);
  if (sockets.size === 0) {
    onlineSocketsByUser.delete(userId);
    return 0;
  }
  return sockets.size;
};

export const isUserOnline = (userId) =>
  (onlineSocketsByUser.get(String(userId))?.size ?? 0) > 0;

const presenceFor = (userId) => ({
  userId: String(userId),
  isOnline: isUserOnline(userId),
  lastSeenAt: lastSeenByUser.get(String(userId)) ?? null,
});

const participantConversations = (userId) =>
  Conversation.find({
    $or: [{ recruiterId: String(userId) }, { jobseekerId: String(userId) }],
  }).select("_id recruiterId jobseekerId");

const notifyPresenceToPeers = async (userId) => {
  if (!io) return;
  const conversations = await participantConversations(userId);
  const peers = new Set();
  for (const conversation of conversations) {
    const peerId =
      String(conversation.recruiterId) === String(userId)
        ? conversation.jobseekerId
        : conversation.recruiterId;
    peers.add(String(peerId));
  }
  const payload = presenceFor(userId);
  for (const peerId of peers) {
    io.to(userRoom(peerId)).emit("presence:update", payload);
  }
};

const markPendingMessagesDelivered = async (userId) => {
  if (!io) return;
  const conversations = await participantConversations(userId);
  const deliveredAt = new Date();

  await Promise.all(
    conversations.map(async (conversation) => {
      const result = await Message.updateMany(
        {
          conversationId: conversation._id,
          senderId: { $ne: String(userId) },
          status: "sent",
        },
        { $set: { status: "delivered", deliveredAt } }
      );
      if (result.modifiedCount === 0) return;

      const payload = {
        conversationId: String(conversation._id),
        recipientId: String(userId),
        status: "delivered",
        deliveredAt,
      };
      io.to(conversationRoom(conversation._id)).emit("messages:status", payload);
      const senderId =
        String(conversation.recruiterId) === String(userId)
          ? conversation.jobseekerId
          : conversation.recruiterId;
      io.to(userRoom(senderId)).emit("messages:status", payload);
    })
  );
};

const assertParticipant = async (conversationId, userId) => {
  if (!isValidObjectId(conversationId)) {
    return { ok: false, message: "Invalid conversation id" };
  }

  const conversation = await Conversation.findById(conversationId).select(
    "recruiterId jobseekerId"
  );
  if (!conversation) {
    return { ok: false, message: "Conversation not found" };
  }

  const isParticipant =
    String(conversation.recruiterId) === String(userId) ||
    String(conversation.jobseekerId) === String(userId);

  if (!isParticipant) {
    return { ok: false, message: "You are not a participant of this conversation" };
  }

  return { ok: true };
};

/**
 * Attach Socket.io to the HTTP server.
 * Auth: JWT via handshake.auth.token or Authorization header.
 *
 * Client events:
 *   conversation:join  { conversationId }
 *   conversation:leave { conversationId }
 *   typing:start       { conversationId }
 *   typing:stop        { conversationId }
 *
 * Server events:
 *   message:new        { chatMessage }
 *   typing:update      { conversationId, userId, isTyping }
 *   presence:update    { userId, isOnline, lastSeenAt }
 *   messages:status    { conversationId, recipientId|readerId, status, ... }
 *   conversation:joined / conversation:error
 */
export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, "");

      if (!token) {
        return next(new Error("Authentication required"));
      }

      const decoded = jwt.verify(token, JWT_SECRET());
      if (!decoded.userId) {
        return next(new Error("Invalid token payload"));
      }

      socket.userId = String(decoded.userId);
      socket.email = decoded.email ?? null;
      socket.accountType = decoded.accountType || "jobseeker";
      next();
    } catch {
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`Socket connected: user=${socket.userId} id=${socket.id}`);

    socket.join(userRoom(socket.userId));
    const connectionCount = addOnlineSocket(socket.userId, socket.id);
    if (connectionCount === 1) {
      void notifyPresenceToPeers(socket.userId);
      void markPendingMessagesDelivered(socket.userId);
    }

    socket.on("conversation:join", async (payload = {}) => {
      try {
        const conversationId = String(payload.conversationId || "").trim();
        const access = await assertParticipant(conversationId, socket.userId);

        if (!access.ok) {
          socket.emit("conversation:error", {
            conversationId,
            message: access.message,
          });
          return;
        }

        const conversation = await Conversation.findById(conversationId).select(
          "recruiterId jobseekerId"
        );
        const peerId =
          String(conversation.recruiterId) === String(socket.userId)
            ? conversation.jobseekerId
            : conversation.recruiterId;

        socket.join(conversationRoom(conversationId));
        socket.emit("conversation:joined", {
          conversationId,
          peerPresence: presenceFor(peerId),
        });
      } catch (error) {
        console.error("conversation:join error:", error.message);
        socket.emit("conversation:error", {
          message: "Could not join conversation",
        });
      }
    });

    socket.on("conversation:leave", (payload = {}) => {
      const conversationId = String(payload.conversationId || "").trim();
      if (!conversationId) return;
      socket
        .to(conversationRoom(conversationId))
        .emit("typing:update", {
          conversationId,
          userId: socket.userId,
          isTyping: false,
        });
      socket.leave(conversationRoom(conversationId));
    });

    const emitTyping = async (payload = {}, isTyping) => {
      try {
        const conversationId = String(payload.conversationId || "").trim();
        const access = await assertParticipant(conversationId, socket.userId);
        if (!access.ok) return;

        socket.to(conversationRoom(conversationId)).emit("typing:update", {
          conversationId,
          userId: socket.userId,
          isTyping: Boolean(isTyping),
        });
      } catch (error) {
        console.error("typing event error:", error.message);
      }
    };

    socket.on("typing:start", (payload) => {
      void emitTyping(payload, true);
    });

    socket.on("typing:stop", (payload) => {
      void emitTyping(payload, false);
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: user=${socket.userId} id=${socket.id}`);
      const remaining = removeOnlineSocket(socket.userId, socket.id);
      if (remaining === 0) {
        lastSeenByUser.set(socket.userId, new Date());
        void notifyPresenceToPeers(socket.userId);
      }
    });
  });

  console.log("Socket.io ready (JWT auth + conversation rooms)");
  return io;
};

export const getIO = () => io;

export const emitMessageStatus = (conversationId, payload, participantIds = []) => {
  if (!io) return;
  let target = io.to(conversationRoom(conversationId));
  for (const participantId of participantIds) {
    if (participantId) target = target.to(userRoom(participantId));
  }
  target.emit("messages:status", {
    conversationId: String(conversationId),
    ...payload,
  });
};

/**
 * Broadcast a new message to the conversation and both participants' personal rooms.
 * Socket.io unions the rooms, so a socket present in more than one receives one event.
 * Safe no-op if Socket.io is not initialized yet.
 */
export const emitNewMessage = (
  conversationId,
  chatMessage,
  participantIds = [],
) => {
  if (!io) return;

  let target = io.to(conversationRoom(conversationId));
  for (const participantId of participantIds) {
    if (participantId) {
      target = target.to(userRoom(participantId));
    }
  }
  target.emit("message:new", { chatMessage });
};
