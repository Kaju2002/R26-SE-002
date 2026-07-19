import express from "express";
import cors from "cors";
import "dotenv/config";
import emailRoute from "./route/emailRoute.js";

const app = express();
const PORT = process.env.PORT || 5004;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/email", emailRoute);

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    service: "email-management-service",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get("/", (req, res) => {
  res.json({
    message: "Welcome to FraudAware Email Management Service",
    version: "1.0.0",
    endpoints: {
      health: "GET /health",
      status: "GET /api/email/status",
      connect: "GET /api/email/connect?provider=google|microsoft&returnTo=",
      callback: "GET /api/email/callback?code=&state=",
      folders: "GET /api/email/folders",
      messages: "GET /api/email/messages?folderKey=inbox&q=&limit=",
      message: "GET /api/email/messages/:messageId",
      send: "POST /api/email/send",
      disconnect: "DELETE /api/email/disconnect",
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

app.listen(PORT, () => {
  console.log(`Email Management Service running on http://localhost:${PORT}`);
  console.log(`Health check: GET http://localhost:${PORT}/health`);
});
