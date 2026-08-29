import "dotenv/config";
import connectDB from "./config/mongodb.js";
import { createApp } from "./app.js";
import { startInterviewReminderPoller } from "./jobs/interviewReminderPoller.js";

const PORT = process.env.PORT || 5001;

connectDB();

const app = createApp();

app.listen(PORT, () => {
  console.log(`Job Management Service running on http://localhost:${PORT}`);
  console.log(`Health check: GET http://localhost:${PORT}/health`);
  startInterviewReminderPoller();
});
