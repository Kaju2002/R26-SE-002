import "dotenv/config";
import { createApp } from "./app.js";

const PORT = process.env.PORT || 5004;
const app = createApp();

app.listen(PORT, () => {
  console.log(`Email Management Service running on http://localhost:${PORT}`);
  console.log(`Health check: GET http://localhost:${PORT}/health`);
});
