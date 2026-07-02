import express from "express";
import cors from "cors";
import "dotenv/config";
import connectDB from "./config/mongodb.js";
import userRoute from "./route/userRoute.js";
import profileRoute from "./route/profileRoute.js";

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
app.use("/api/profile", profileRoute);

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
      auth: {
        register: "POST /api/auth/register",
        login: "POST /api/auth/login",
        verifyEmail: "POST /api/auth/verify-email",
      },
      profile: {
        getMe: "GET /api/profile/me",
        updateBasic: "PATCH /api/profile/basic",
        updateSummary: "PATCH /api/profile/summary",
        updateSkills: "PUT /api/profile/skills",
        workExperience: "POST/PUT/DELETE /api/profile/work-experience/:itemId",
        education: "POST/PUT/DELETE /api/profile/education/:itemId",
        languages: "POST/PUT/DELETE /api/profile/languages/:itemId",
        avatar: "PATCH /api/profile/avatar",
        cv: "POST/DELETE /api/profile/cv/:cvId",
      },
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

// ==== START SERVER ====
app.listen(PORT, () => {
  console.log(`✅ User Management Service running on http://localhost:${PORT}`);
  console.log(`📍 Auth: POST http://localhost:${PORT}/api/auth/register`);
  console.log(`👤 Profile: GET http://localhost:${PORT}/api/profile/me`);
  console.log(`🏥 Health check: GET http://localhost:${PORT}/health`);
});

