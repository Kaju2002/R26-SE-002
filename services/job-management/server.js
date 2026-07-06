import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import "dotenv/config";
import connectDB from "./config/mongodb.js";

const app = express();
const PORT = process.env.PORT || 5001;

connectDB();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", (req, res) => {
  const dbStates = ["disconnected", "connected", "connecting", "disconnecting"];
  const dbState = dbStates[mongoose.connection.readyState] ?? "unknown";

  res.status(200).json({
    status: "OK",
    service: "job-management-service",
    database: dbState,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get("/", (req, res) => {
  res.json({
    message: "Welcome to FraudAware Job Management Service",
    version: "1.0.0",
    endpoints: {
      health: "GET /health",
      jobs: "Coming soon: GET/POST /api/jobs",
      applications: "Coming soon: POST /api/jobs/:id/apply",
      savedJobs: "Coming soon: GET /api/jobs/saved",
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

app.listen(PORT, () => {
  console.log(`Job Management Service running on http://localhost:${PORT}`);
  console.log(`Health check: GET http://localhost:${PORT}/health`);
});
