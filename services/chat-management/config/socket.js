import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import Conversation from "../model/conversationModel.js";

const JWT_SECRET = () => process.env.JWT_SECRET || "greatStack";
const isValidObjectId = (id) => /^[a-fA-F0-9]{24}$/.test(String(id));

let io = null;

const conversationRoom = (conversationId) => `conversation:${conversationId}`;

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

    // Personal room — useful later for inbox badges / notifications.
    socket.join(`user:${socket.userId}`);

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

        socket.join(conversationRoom(conversationId));
        socket.emit("conversation:joined", { conversationId });
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
    });
  });

  console.log("Socket.io ready (JWT auth + conversation rooms)");
  return io;
};

export const getIO = () => io;

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
      target = target.to(`user:${String(participantId)}`);
    }
  }
  target.emit("message:new", { chatMessage });
};
