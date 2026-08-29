import "dotenv/config";
import connectDB from "./config/mongodb.js";
import { createApp } from "./app.js";

const PORT = process.env.PORT || 5000;

connectDB();

const app = createApp();

app.listen(PORT, () => {
  console.log(`✅ User Management Service running on http://localhost:${PORT}`);
  console.log(`📍 Auth: POST http://localhost:${PORT}/api/auth/register`);
  console.log(`👤 Profile: GET http://localhost:${PORT}/api/profile/me`);
  console.log(`🏥 Health check: GET http://localhost:${PORT}/health`);
});
