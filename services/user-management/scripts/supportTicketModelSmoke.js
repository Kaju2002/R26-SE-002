/**
 * Part 1 smoke test — insert + read one SupportTicket document.
 *
 * Usage (from services/user-management):
 *   node scripts/supportTicketModelSmoke.js
 *
 * Requires MONGODB_URI in .env
 */

import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../config/mongodb.js";
import SupportTicket from "../model/supportTicketModel.js";

const SMOKE_TICKET_NUMBER = "TKT-SMOKE-001";

async function run() {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is not set in .env");
    process.exit(1);
  }

  await connectDB();

  await SupportTicket.deleteOne({ ticketNumber: SMOKE_TICKET_NUMBER });

  const now = new Date();
  const created = await SupportTicket.create({
    ticketNumber: SMOKE_TICKET_NUMBER,
    subject: "Smoke test ticket",
    description: "Verifies SupportTicket model persistence.",
    requesterName: "Smoke Test User",
    requesterEmail: "smoke.test@fraudaware.lk",
    status: "open",
    priority: "low",
    linkedType: "none",
    messages: [
      {
        author: "user",
        authorName: "Smoke Test User",
        body: "Initial message from smoke script.",
        createdAt: now,
      },
    ],
  });

  const loaded = await SupportTicket.findById(created._id).lean();
  if (!loaded) {
    throw new Error("Could not reload created ticket");
  }

  console.log("SupportTicket model smoke test passed.");
  console.log({
    id: String(loaded._id),
    ticketNumber: loaded.ticketNumber,
    status: loaded.status,
    messageCount: loaded.messages?.length ?? 0,
  });

  await mongoose.disconnect();
}

run().catch((error) => {
  console.error("SupportTicket model smoke test failed:", error);
  mongoose.disconnect().finally(() => process.exit(1));
});
