import http from "http";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import "dotenv/config";
import connectDB from "./config/mongodb.js";
import { initSocket } from "./config/socket.js";
import chatRoute from "./route/chatRoute.js";

const app = express();
const PORT = process.env.PORT || 5003;

connectDB();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/chat", chatRoute);

app.get("/health", (req, res) => {
  const dbStates = ["disconnected", "connected", "connecting", "disconnecting"];
  const dbState = dbStates[mongoose.connection.readyState] ?? "unknown";

  res.status(200).json({
    status: "OK",
    service: "chat-management-service",
    database: dbState,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get("/", (req, res) => {
  res.json({
    message: "Welcome to FraudAware Chat Management Service",
    version: "1.0.0",
    endpoints: {
      health: "GET /health",
      me: "GET /api/chat/me (Bearer token required)",
      listConversations: "GET /api/chat/conversations (Bearer token required)",
      createConversation: "POST /api/chat/conversations (Bearer token required)",
      getMessages:
        "GET /api/chat/conversations/:conversationId/messages (Bearer token required)",
      sendMessage:
        "POST /api/chat/conversations/:conversationId/messages (Bearer token required)",
      socket: "Socket.io on same port (JWT in auth.token)",
      // Coming next: wire dashboard / mobile UI to these APIs
    },
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

const server = http.createServer(app);
initSocket(server);

server.listen(PORT, () => {
  console.log(`Chat Management Service running on http://localhost:${PORT}`);
  console.log(`Health check: GET http://localhost:${PORT}/health`);
  console.log(`Auth test: GET http://localhost:${PORT}/api/chat/me`);
  console.log(`Socket.io: ws://localhost:${PORT} (auth.token = JWT)`);
});

const shutdown = async () => {
  console.log("Chat Management: shutting down...");
  await mongoose.connection.close();
  server.close(() => process.exit(0));
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
