import express from "express";
import cors from "cors";
import userRoute from "./route/userRoute.js";
import profileRoute from "./route/profileRoute.js";
import internalRoute from "./route/internalRoute.js";
import adminRoute from "./route/adminRoute.js";
import supportRoute from "./route/supportRoute.js";

export const createApp = () => {
  const app = express();

  app.use(
    cors({
      origin: "*",
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Accept",
        "Origin",
        "x-internal-service-key",
      ],
      exposedHeaders: ["Content-Range", "X-Content-Range"],
    })
  );

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use("/api/auth", userRoute);
  app.use("/api/profile", profileRoute);
  app.use("/api/internal", internalRoute);
  app.use("/api/admin", adminRoute);
  app.use("/api/support", supportRoute);

  app.get("/health", (req, res) => {
    res.status(200).json({
      status: "OK",
      service: "user-management-service",
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

    if (err.name === "MulterError") {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }

    res.status(err.status || 500).json({
      success: false,
      message: err.message || "Internal server error",
    });
  });

  return app;
};
