import "dotenv/config";
import connectDB from "./config/mongodb.js";
import { createApp } from "./app.js";
import { startRabbitConsumerWithRetry, stopRabbitConsumer } from "./consumer/rabbitConsumer.js";

const PORT = process.env.PORT || 5002;

connectDB();

const app = createApp();
const server = app.listen(PORT, async () => {
  console.log(`Notification Management Service running on http://localhost:${PORT}`);
  console.log(`Health check: GET http://localhost:${PORT}/health`);
  await startRabbitConsumerWithRetry();
});

const shutdown = async () => {
  console.log("Notification Management: shutting down...");
  await stopRabbitConsumer();
  const mongoose = await import("mongoose");
  await mongoose.default.connection.close();
  server.close(() => process.exit(0));
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
