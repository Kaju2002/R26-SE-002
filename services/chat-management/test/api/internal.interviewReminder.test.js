import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const CONVERSATION_ID = "507f1f77bcf86cd799439011";
const MESSAGE_ID = "507f1f77bcf86cd799439012";
const APPLICATION_ID = "507f1f77bcf86cd799439013";

const {
  mockConversationFindOne,
  mockConversationCreate,
  mockMessageCreate,
} = vi.hoisted(() => ({
  mockConversationFindOne: vi.fn(),
  mockConversationCreate: vi.fn(),
  mockMessageCreate: vi.fn(),
}));

vi.mock("../../config/mongodb.js", () => ({ default: vi.fn() }));
vi.mock("../../model/conversationModel.js", () => ({
  default: {
    findOne: (...args) => mockConversationFindOne(...args),
    create: (...args) => mockConversationCreate(...args),
  },
}));
vi.mock("../../model/messageModel.js", () => ({
  default: {
    create: (...args) => mockMessageCreate(...args),
  },
}));
vi.mock("../../utils/publishEvent.js", () => ({ publishEvent: vi.fn() }));
vi.mock("../../config/socket.js", () => ({
  emitNewMessage: vi.fn(),
  emitConversationStatus: vi.fn(),
  isUserOnline: vi.fn(() => false),
}));

import { createApp } from "../../app.js";

describe("POST /api/chat/internal/interview-reminder", () => {
  const app = createApp();
  const internalHeaders = { "x-internal-service-key": "test-internal-key" };
  const payload = {
    applicationId: APPLICATION_ID,
    recruiterId: "recruiter-1",
    jobseekerId: "jobseeker-1",
    jobId: "507f1f77bcf86cd799439014",
    body: "Reminder: your interview is in 24 hours.",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.INTERNAL_SERVICE_KEY = "test-internal-key";
  });

  afterEach(() => {
    delete process.env.INTERNAL_SERVICE_KEY;
  });

  it("returns 401 without the internal service key", async () => {
    const response = await request(app)
      .post("/api/chat/internal/interview-reminder")
      .send(payload);

    expect(response.status).toBe(401);
    expect(response.body.message).toMatch(/unauthorized internal request/i);
  });

  it("returns 400 when required fields are missing", async () => {
    const response = await request(app)
      .post("/api/chat/internal/interview-reminder")
      .set(internalHeaders)
      .send({ applicationId: APPLICATION_ID });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/required/i);
  });

  it("skips posting when the conversation is blocked", async () => {
    mockConversationFindOne.mockResolvedValue({
      _id: CONVERSATION_ID,
      status: "blocked",
      recruiterId: "recruiter-1",
      jobseekerId: "jobseeker-1",
    });

    const response = await request(app)
      .post("/api/chat/internal/interview-reminder")
      .set(internalHeaders)
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body.skipped).toBe(true);
    expect(response.body.reason).toBe("conversation-blocked");
    expect(mockMessageCreate).not.toHaveBeenCalled();
  });

  it("creates a reminder message for an existing conversation", async () => {
    const conversation = {
      _id: CONVERSATION_ID,
      status: "active",
      recruiterId: "recruiter-1",
      jobseekerId: "jobseeker-1",
      unreadCounts: { recruiter: 0, jobseeker: 0 },
      save: vi.fn().mockResolvedValue(undefined),
    };
    mockConversationFindOne.mockResolvedValue(conversation);
    mockMessageCreate.mockResolvedValue({
      _id: MESSAGE_ID,
      conversationId: CONVERSATION_ID,
      senderId: "recruiter-1",
      messageType: "text",
      body: payload.body,
      status: "sent",
      createdAt: new Date("2026-08-29T10:00:00.000Z"),
      updatedAt: new Date("2026-08-29T10:00:00.000Z"),
      save: vi.fn().mockResolvedValue(undefined),
    });

    const response = await request(app)
      .post("/api/chat/internal/interview-reminder")
      .set(internalHeaders)
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.conversationId).toBe(CONVERSATION_ID);
    expect(response.body.messageId).toBe(MESSAGE_ID);
    expect(mockMessageCreate).toHaveBeenCalled();
    expect(conversation.save).toHaveBeenCalled();
  });
});
