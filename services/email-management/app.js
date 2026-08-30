import express from "express";
import cors from "cors";
import emailRoute from "./route/emailRoute.js";

export const createApp = () => {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use("/api/email", emailRoute);

  app.get("/health", (req, res) => {
    res.status(200).json({
      status: "OK",
      service: "email-management-service",
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
