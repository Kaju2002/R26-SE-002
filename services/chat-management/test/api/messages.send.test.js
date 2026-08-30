import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const CONVERSATION_ID = "507f1f77bcf86cd799439011";
const MESSAGE_ID = "507f1f77bcf86cd799439012";

const {
  mockConversationFindById,
  mockConversationFindByIdAndUpdate,
  mockMessageCreate,
  mockAnalyzeMessageForScam,
} = vi.hoisted(() => ({
  mockConversationFindById: vi.fn(),
  mockConversationFindByIdAndUpdate: vi.fn(),
  mockMessageCreate: vi.fn(),
  mockAnalyzeMessageForScam: vi.fn(),
}));

vi.mock("../../config/mongodb.js", () => ({ default: vi.fn() }));
vi.mock("../../model/conversationModel.js", () => ({
  default: {
    findById: (...args) => mockConversationFindById(...args),
    findByIdAndUpdate: (...args) => mockConversationFindByIdAndUpdate(...args),
  },
}));
vi.mock("../../model/messageModel.js", () => ({
  default: {
    create: (...args) => mockMessageCreate(...args),
    find: vi.fn(),
    findOne: vi.fn(),
    countDocuments: vi.fn(),
  },
}));
vi.mock("../../utils/scamDetectionClient.js", () => ({
  analyzeMessageForScam: (...args) => mockAnalyzeMessageForScam(...args),
}));
vi.mock("../../utils/jobManagementClient.js", () => ({
  fetchApplication: vi.fn().mockResolvedValue({ ok: false }),
  fetchWorkspace: vi.fn(),
}));
vi.mock("../../utils/publishEvent.js", () => ({ publishEvent: vi.fn() }));
vi.mock("../../utils/chatImageUpload.js", () => ({
  uploadChatImage: vi.fn(),
  uploadChatAudio: vi.fn(),
  uploadChatDocument: vi.fn(),
  deleteUploadedAttachment: vi.fn(),
}));
vi.mock("../../config/socket.js", () => ({
  emitNewMessage: vi.fn(),
  emitMessageDeleted: vi.fn(),
  emitMessageStatus: vi.fn(),
  emitConversationCleared: vi.fn(),
  isUserOnline: vi.fn(() => false),
}));

import { createApp } from "../../app.js";
import { authHeader, signTestToken } from "../helpers/auth.js";

const activeConversation = (overrides = {}) => ({
  _id: CONVERSATION_ID,
  recruiterId: "recruiter-1",
  jobseekerId: "jobseeker-1",
  workspaceId: null,
  status: "active",
  blockedBy: null,
  applicationId: "app-1",
  unreadCounts: { recruiter: 0, jobseeker: 0 },
  ...overrides,
});

describe("POST /api/chat/conversations/:conversationId/messages", () => {
  const app = createApp();
  const jobseekerToken = signTestToken({
    userId: "jobseeker-1",
    accountType: "jobseeker",
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockConversationFindById.mockResolvedValue(activeConversation());
    mockConversationFindByIdAndUpdate.mockResolvedValue({});
    mockAnalyzeMessageForScam.mockResolvedValue({
      status: "not_checked",
      isScam: false,
      score: null,
      tactics: [],
      analyzedAt: null,
    });
  });

  it("returns 401 without auth", async () => {
    const response = await request(app)
      .post(`/api/chat/conversations/${CONVERSATION_ID}/messages`)
      .send({ body: "Hello" });

    expect(response.status).toBe(401);
  });

  it("returns 400 when body and attachment are missing", async () => {
    const response = await request(app)
      .post(`/api/chat/conversations/${CONVERSATION_ID}/messages`)
      .set(authHeader(jobseekerToken))
      .send({ body: "   " });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/body or attachment is required/i);
  });

  it("returns 400 when message exceeds 5000 characters", async () => {
    const response = await request(app)
      .post(`/api/chat/conversations/${CONVERSATION_ID}/messages`)
      .set(authHeader(jobseekerToken))
      .send({ body: "x".repeat(5001) });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/5000 characters/i);
  });

  it("returns 403 when the caller blocked the conversation", async () => {
    mockConversationFindById.mockResolvedValue(
      activeConversation({
        status: "blocked",
        blockedBy: "jobseeker-1",
      })
    );

    const response = await request(app)
      .post(`/api/chat/conversations/${CONVERSATION_ID}/messages`)
      .set(authHeader(jobseekerToken))
      .send({ body: "Hello again" });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("BLOCKED_BY_YOU");
  });

  it("creates a text message for an authorized jobseeker", async () => {
    const createdAt = new Date("2026-08-29T10:00:00.000Z");
    mockMessageCreate.mockResolvedValue({
      _id: MESSAGE_ID,
      conversationId: CONVERSATION_ID,
      senderId: "jobseeker-1",
      messageType: "text",
      body: "When is the interview?",
      attachments: [],
      status: "sent",
      deliveredAt: null,
      scamAnalysis: {
        status: "not_checked",
        isScam: false,
        score: null,
        tactics: [],
        analyzedAt: null,
      },
      suppressedForPeer: false,
      createdAt,
      updatedAt: createdAt,
    });

    const response = await request(app)
      .post(`/api/chat/conversations/${CONVERSATION_ID}/messages`)
      .set(authHeader(jobseekerToken))
      .send({ body: "When is the interview?" });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.chatMessage.messageType).toBe("text");
    expect(mockAnalyzeMessageForScam).not.toHaveBeenCalled();
  });

  it("runs scam analysis for recruiter messages", async () => {
    const recruiterToken = signTestToken({
      userId: "recruiter-1",
      accountType: "recruiter",
    });
    mockAnalyzeMessageForScam.mockResolvedValue({
      status: "flagged",
      isScam: true,
      score: 0.92,
      tactics: ["payment_request"],
      analyzedAt: new Date("2026-08-29T10:00:00.000Z"),
    });
    mockMessageCreate.mockResolvedValue({
      _id: MESSAGE_ID,
      conversationId: CONVERSATION_ID,
      senderId: "recruiter-1",
      messageType: "text",
      body: "Pay GHS 200 registration fee",
      attachments: [],
      status: "sent",
      deliveredAt: null,
      scamAnalysis: {
        status: "flagged",
        isScam: true,
        score: 0.92,
        tactics: ["payment_request"],
        analyzedAt: new Date("2026-08-29T10:00:00.000Z"),
      },
      suppressedForPeer: false,
      createdAt: new Date("2026-08-29T10:00:00.000Z"),
      updatedAt: new Date("2026-08-29T10:00:00.000Z"),
    });

    const response = await request(app)
      .post(`/api/chat/conversations/${CONVERSATION_ID}/messages`)
      .set(authHeader(recruiterToken))
      .send({ body: "Pay GHS 200 registration fee" });

    expect(response.status).toBe(201);
    expect(mockAnalyzeMessageForScam).toHaveBeenCalledWith(
      "Pay GHS 200 registration fee",
      "recruiter-1"
    );
  });
});
