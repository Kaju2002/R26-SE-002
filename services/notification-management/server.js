import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import "dotenv/config";
import connectDB from "./config/mongodb.js";
import notificationRoute from "./route/notificationRoute.js";
import { startRabbitConsumerWithRetry, stopRabbitConsumer } from "./consumer/rabbitConsumer.js";

const app = express();
const PORT = process.env.PORT || 5002;

connectDB();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/notifications", notificationRoute);

app.get("/health", (req, res) => {
  const dbStates = ["disconnected", "connected", "connecting", "disconnecting"];
  const dbState = dbStates[mongoose.connection.readyState] ?? "unknown";

  res.status(200).json({
    status: "OK",
    service: "notification-management-service",
    database: dbState,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get("/", (req, res) => {
  res.json({
    message: "Welcome to FraudAware Notification Management Service",
    version: "1.0.0",
    endpoints: {
      health: "GET /health",
      listNotifications: "GET /api/notifications?category=general|applications",
      markRead: "PATCH /api/notifications/:id/read",
      markAllRead: "PATCH /api/notifications/read-all?category=general|applications",
      deleteNotification: "DELETE /api/notifications/:id",
      clearNotifications: "DELETE /api/notifications?category=general|applications",
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

const server = app.listen(PORT, async () => {
  console.log(`Notification Management Service running on http://localhost:${PORT}`);
  console.log(`Health check: GET http://localhost:${PORT}/health`);
  await startRabbitConsumerWithRetry();
});

const shutdown = async () => {
  console.log("Notification Management: shutting down...");
  await stopRabbitConsumer();
  await mongoose.connection.close();
  server.close(() => process.exit(0));
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
