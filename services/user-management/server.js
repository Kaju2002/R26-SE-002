import express from "express";
import cors from "cors";
import "dotenv/config";
import connectDB from "./config/mongodb.js";
import userRoute from "./route/userRoute.js";

// ==== APP CONFIG ====
const app = express();
const PORT = process.env.PORT || 5000;

// ==== DATABASE CONNECTION ====
connectDB();

// ==== MIDDLEWARE ====
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==== ROUTES ====
app.use("/api/auth", userRoute);

// ==== HEALTH CHECK ====
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    service: "user-management-service",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ==== HOME ROUTE ====
app.get("/", (req, res) => {
  res.json({
    message: "Welcome to FraudAware User Management Service",
    version: "1.0.0",
    endpoints: {
      register: "POST /api/auth/register",
      health: "GET /health",
    },
  });
});

// ==== 404 HANDLER ====
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// ==== ERROR HANDLER ====
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

// ==== START SERVER ====
app.listen(PORT, () => {
  console.log(`✅ User Management Service running on http://localhost:${PORT}`);
  console.log(`📍 Register endpoint: POST http://localhost:${PORT}/api/auth/register`);
  console.log(`🏥 Health check: GET http://localhost:${PORT}/health`);
});

