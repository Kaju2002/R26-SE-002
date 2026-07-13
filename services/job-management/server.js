import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import "dotenv/config";
import connectDB from "./config/mongodb.js";
import jobRoute from "./route/jobRoute.js";

const app = express();
const PORT = process.env.PORT || 5001;

connectDB();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/jobs", jobRoute);

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
      authPing: "GET /api/jobs/me/ping (protected, temporary)",
      listJobs: "GET /api/jobs",
      createJob: "POST /api/jobs",
      myJobs: "GET /api/jobs/mine",
      jobDetails: "GET /api/jobs/:id",
      updateJob: "PUT /api/jobs/:id",
      deleteJob: "DELETE /api/jobs/:id",
      savedJobs: "GET /api/jobs/saved",
      appliedJobs: "GET /api/jobs/applied",
      downloadApplicationResume: "GET /api/jobs/applications/:applicationId/resume",
      updateApplicationStatus: "PATCH /api/jobs/applications/:applicationId/status",
      getJobApplications: "GET /api/jobs/:id/applications",
      saveJob: "POST /api/jobs/saved",
      unsaveJob: "DELETE /api/jobs/saved/:jobId",
      applyToJob: "POST /api/jobs/:id/apply",
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
