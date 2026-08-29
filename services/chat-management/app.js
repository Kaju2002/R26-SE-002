import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import chatRoute from "./route/chatRoute.js";

export const createApp = () => {
  const app = express();

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

  return app;
};
