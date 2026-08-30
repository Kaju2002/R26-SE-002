import http from "http";
import "dotenv/config";
import connectDB from "./config/mongodb.js";
import { createApp } from "./app.js";
import { initSocket } from "./config/socket.js";

const PORT = process.env.PORT || 5003;

connectDB();

const app = createApp();
const server = http.createServer(app);
initSocket(server);

server.listen(PORT, () => {
  console.log(`Chat Management Service running on http://localhost:${PORT}`);
  console.log(`Health check: GET http://localhost:${PORT}/health`);
});

const shutdown = async () => {
  console.log("Chat Management: shutting down...");
  const mongoose = await import("mongoose");
  await mongoose.default.connection.close();
  server.close(() => process.exit(0));
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
