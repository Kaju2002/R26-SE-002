import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const CONVERSATION_ID = "507f1f77bcf86cd799439011";
const MESSAGE_ID = "507f1f77bcf86cd799439012";

const {
  mockConversationFindById,
  mockMessageFindOne,
  mockMessageFindByIdAndUpdate,
} = vi.hoisted(() => ({
  mockConversationFindById: vi.fn(),
  mockMessageFindByIdAndUpdate: vi.fn(),
  mockMessageFindOne: vi.fn(),
}));

vi.mock("../../config/mongodb.js", () => ({ default: vi.fn() }));
vi.mock("../../model/conversationModel.js", () => ({
  default: {
    findById: (...args) => mockConversationFindById(...args),
    findByIdAndUpdate: vi.fn(),
  },
}));
vi.mock("../../model/messageModel.js", () => ({
  default: {
    findOne: (...args) => mockMessageFindOne(...args),
    findByIdAndUpdate: (...args) => mockMessageFindByIdAndUpdate(...args),
  },
}));
vi.mock("../../utils/jobManagementClient.js", () => ({
  fetchApplication: vi.fn(),
  fetchWorkspace: vi.fn(),
}));
vi.mock("../../config/socket.js", () => ({
  emitNewMessage: vi.fn(),
  emitMessageUpdated: vi.fn(),
  emitMessageDeleted: vi.fn(),
  emitMessageStatus: vi.fn(),
  emitConversationCleared: vi.fn(),
  isUserOnline: vi.fn(),
}));

import { createApp } from "../../app.js";
import { authHeader, signTestToken } from "../helpers/auth.js";

const conversationDoc = {
  _id: CONVERSATION_ID,
  recruiterId: "recruiter-1",
  jobseekerId: "jobseeker-1",
  workspaceId: null,
  lastMessage: { messageId: MESSAGE_ID },
};

describe("DELETE /api/chat/conversations/:conversationId/messages/:messageId", () => {
  const app = createApp();
  const jobseekerToken = signTestToken({
    userId: "jobseeker-1",
    accountType: "jobseeker",
  });
  const recruiterToken = signTestToken({
    userId: "recruiter-1",
    accountType: "recruiter",
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockConversationFindById.mockResolvedValue(conversationDoc);
  });

  it("returns 400 for invalid delete mode", async () => {
    const response = await request(app)
      .delete(`/api/chat/conversations/${CONVERSATION_ID}/messages/${MESSAGE_ID}`)
      .set(authHeader(jobseekerToken))
      .send({ mode: "invalid" });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/must be "me" or "everyone"/i);
  });

  it("deletes a message for the caller only", async () => {
    mockMessageFindOne.mockResolvedValue({
      _id: MESSAGE_ID,
      conversationId: CONVERSATION_ID,
      senderId: "recruiter-1",
      deletedFor: [],
    });
    mockMessageFindByIdAndUpdate.mockResolvedValue({});

    const response = await request(app)
      .delete(`/api/chat/conversations/${CONVERSATION_ID}/messages/${MESSAGE_ID}`)
      .set(authHeader(jobseekerToken))
      .send({ mode: "me" });

    expect(response.status).toBe(200);
    expect(response.body.mode).toBe("me");
    expect(mockMessageFindByIdAndUpdate).toHaveBeenCalled();
  });

  it("returns 403 when a non-sender tries delete-for-everyone", async () => {
    mockMessageFindOne.mockResolvedValue({
      _id: MESSAGE_ID,
      conversationId: CONVERSATION_ID,
      senderId: "recruiter-1",
      deletedFor: [],
      deletedForEveryone: false,
    });

    const response = await request(app)
      .delete(`/api/chat/conversations/${CONVERSATION_ID}/messages/${MESSAGE_ID}`)
      .set(authHeader(jobseekerToken))
      .send({ mode: "everyone" });

    expect(response.status).toBe(403);
    expect(response.body.message).toMatch(/only the sender/i);
  });

  it("hides the message from users but keeps the original for moderators", async () => {
    const scamAnalysis = {
      status: "flagged",
      isScam: true,
      score: 0.94,
      tactics: ["payment_request"],
      analyzedAt: new Date("2026-08-29T10:00:00.000Z"),
    };
    const attachments = [
      {
        url: "https://res.cloudinary.com/demo/fee.png",
        publicId: "chat/fee",
        fileName: "fee.png",
        mimeType: "image/png",
        size: 10,
      },
    ];
    const message = {
      _id: MESSAGE_ID,
      conversationId: CONVERSATION_ID,
      senderId: "recruiter-1",
      deletedFor: [],
      deletedForEveryone: false,
      body: "Pay LKR 5000 registration fee",
      attachments,
      messageType: "image",
      status: "sent",
      scamAnalysis,
      save: vi.fn().mockResolvedValue(undefined),
    };
    mockMessageFindOne.mockResolvedValue(message);

    const response = await request(app)
      .delete(`/api/chat/conversations/${CONVERSATION_ID}/messages/${MESSAGE_ID}`)
      .set(authHeader(recruiterToken))
      .send({ mode: "everyone" });

    expect(response.status).toBe(200);
    expect(message.save).toHaveBeenCalled();
    expect(message.deletedForEveryone).toBe(true);
    expect(message.deletedBy).toBe("recruiter-1");
    // Stored document keeps the evidence.
    expect(message.body).toBe("Pay LKR 5000 registration fee");
    expect(message.attachments).toBe(attachments);
    expect(message.messageType).toBe("image");
    expect(message.scamAnalysis).toBe(scamAnalysis);
    // Participants only ever see the tombstone.
    const chatMessage = response.body.chatMessage;
    expect(chatMessage.body).toBe("This message was deleted");
    expect(chatMessage.messageType).toBe("system");
    expect(chatMessage.attachments).toEqual([]);
    expect(chatMessage.scamAnalysis.status).toBe("not_checked");
  });
});
