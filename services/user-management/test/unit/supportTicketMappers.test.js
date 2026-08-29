import { describe, expect, it } from "vitest";
import {
  mapSupportMessage,
  mapSupportTicket,
  mapSupportTicketForUser,
} from "../../controller/supportTicketController.js";

const ticketDoc = {
  _id: "507f1f77bcf86cd799439011",
  ticketNumber: "TKT-42",
  subject: "Cannot login",
  description: "App shows invalid token",
  requesterUserId: "507f1f77bcf86cd799439012",
  requesterName: "Sam Perera",
  requesterEmail: "sam@example.com",
  status: "open",
  priority: "high",
  assigneeUserId: null,
  assigneeName: null,
  assigneeEmail: null,
  linkedType: "none",
  linkedId: null,
  linkedLabel: null,
  internalNote: "Check auth middleware",
  messages: [
    {
      _id: "507f1f77bcf86cd799439013",
      author: "user",
      authorName: "Sam Perera",
      body: "Still blocked",
      createdAt: new Date("2026-08-29T10:00:00.000Z"),
    },
  ],
  closedAt: null,
  createdAt: new Date("2026-08-29T09:00:00.000Z"),
  updatedAt: new Date("2026-08-29T10:05:00.000Z"),
};

describe("support ticket mappers", () => {
  it("normalizes ticket ids and timestamps", () => {
    const ticket = mapSupportTicket(ticketDoc);
    expect(ticket.id).toBe("507f1f77bcf86cd799439011");
    expect(ticket.createdAt).toBe("2026-08-29T09:00:00.000Z");
  });

  it("omits internal notes from user-facing ticket shape", () => {
    const ticket = mapSupportTicketForUser(ticketDoc);
    expect(ticket.subject).toBe("Cannot login");
    expect("internalNote" in ticket).toBe(false);
  });

  it("maps support message metadata", () => {
    const message = mapSupportMessage(ticketDoc.messages[0]);
    expect(message.author).toBe("user");
    expect(message.createdAt).toBe("2026-08-29T10:00:00.000Z");
  });
});
