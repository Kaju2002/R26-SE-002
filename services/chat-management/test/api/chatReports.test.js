import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const CONVERSATION_ID = "507f1f77bcf86cd799439011";
const REPORT_ID = "507f1f77bcf86cd799439013";

const {
  mockConversationFindById,
  mockChatReportFindOne,
  mockChatReportCreate,
  mockMessageFind,
} = vi.hoisted(() => ({
  mockConversationFindById: vi.fn(),
  mockChatReportFindOne: vi.fn(),
  mockChatReportCreate: vi.fn(),
  mockMessageFind: vi.fn(),
}));

vi.mock("../../config/mongodb.js", () => ({ default: vi.fn() }));
vi.mock("../../model/conversationModel.js", () => ({
  default: {
    findById: (...args) => mockConversationFindById(...args),
  },
}));
vi.mock("../../model/messageModel.js", () => ({
  default: {
    find: (...args) => mockMessageFind(...args),
  },
}));
vi.mock("../../model/chatReportModel.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: {
      findOne: (...args) => mockChatReportFindOne(...args),
      create: (...args) => mockChatReportCreate(...args),
      findById: vi.fn(),
    },
  };
});
vi.mock("../../utils/jobManagementClient.js", () => ({
  fetchApplication: vi.fn(),
  fetchWorkspace: vi.fn(),
}));
vi.mock("../../utils/auditLogClient.js", () => ({
  recordAuditLog: vi.fn(),
}));

import { createApp } from "../../app.js";
import { authHeader, signTestToken } from "../helpers/auth.js";

const conversationDoc = {
  _id: CONVERSATION_ID,
  recruiterId: "recruiter-1",
  jobseekerId: "jobseeker-1",
  workspaceId: null,
  applicationId: "app-1",
  jobId: "job-1",
  workspaceName: "Acme Ltd",
};

describe("POST /api/chat/conversations/:conversationId/reports", () => {
  const app = createApp();
  const jobseekerToken = signTestToken({
    userId: "jobseeker-1",
    accountType: "jobseeker",
    email: "jane@example.com",
  });
  const recruiterToken = signTestToken({
    userId: "recruiter-1",
    accountType: "recruiter",
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockConversationFindById.mockResolvedValue(conversationDoc);
    mockChatReportFindOne.mockResolvedValue(null);
    mockMessageFind.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([
          {
            _id: "msg-1",
            senderId: "recruiter-1",
            messageType: "text",
            body: "Pay a registration fee",
            createdAt: new Date("2026-08-29T10:00:00.000Z"),
            scamAnalysis: {
              status: "flagged",
              isScam: true,
              score: 0.93,
              tactics: ["payment_request"],
            },
          },
        ]),
      }),
    });
  });

  it("returns 400 for invalid reasonCode", async () => {
    const response = await request(app)
      .post(`/api/chat/conversations/${CONVERSATION_ID}/reports`)
      .set(authHeader(jobseekerToken))
      .send({ reasonCode: "invalid_reason" });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/invalid reasonCode/i);
  });

  it("returns 403 when a recruiter tries to report", async () => {
    const response = await request(app)
      .post(`/api/chat/conversations/${CONVERSATION_ID}/reports`)
      .set(authHeader(recruiterToken))
      .send({ reasonCode: "payment_request", details: "Asked for money" });

    expect(response.status).toBe(403);
    expect(response.body.message).toMatch(/only the jobseeker/i);
  });

  it("returns existing open report without creating a duplicate", async () => {
    const existing = {
      _id: REPORT_ID,
      conversationId: String(CONVERSATION_ID),
      reporterId: "jobseeker-1",
      reasonCode: "payment_request",
      status: "new",
      createdAt: new Date("2026-08-29T09:00:00.000Z"),
    };
    mockChatReportFindOne.mockResolvedValue(existing);

    const response = await request(app)
      .post(`/api/chat/conversations/${CONVERSATION_ID}/reports`)
      .set(authHeader(jobseekerToken))
      .send({ reasonCode: "payment_request" });

    expect(response.status).toBe(200);
    expect(response.body.alreadyExists).toBe(true);
    expect(mockChatReportCreate).not.toHaveBeenCalled();
  });

  it("creates an evidence pack for a valid jobseeker report", async () => {
    const createdAt = new Date("2026-08-29T10:10:00.000Z");
    mockChatReportCreate.mockResolvedValue({
      _id: REPORT_ID,
      conversationId: String(CONVERSATION_ID),
      applicationId: "app-1",
      jobId: "job-1",
      recruiterId: "recruiter-1",
      jobseekerId: "jobseeker-1",
      workspaceName: "Acme Ltd",
      peerLabel: "Acme Ltd",
      jobLabel: "",
      reporterId: "jobseeker-1",
      reporterName: "Jane",
      reporterEmail: "jane@example.com",
      reporterRole: "jobseeker",
      reasonCode: "payment_request",
      details: "Asked for upfront payment",
      tacticsSummary: ["payment_request"],
      flaggedCount: 1,
      maxScore: 0.93,
      riskLevel: "high",
      status: "new",
      createdAt,
      evidenceMessages: [],
      timeline: [],
    });

    const response = await request(app)
      .post(`/api/chat/conversations/${CONVERSATION_ID}/reports`)
      .set(authHeader(jobseekerToken))
      .send({
        reasonCode: "payment_request",
        details: "Asked for upfront payment",
        reporterName: "Jane",
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.report.reasonCode).toBe("payment_request");
    expect(mockChatReportCreate).toHaveBeenCalled();
  });
});

describe("PATCH /api/chat/reports/:reportId/feedback", () => {
  const app = createApp();
  const jobseekerToken = signTestToken({
    userId: "jobseeker-1",
    accountType: "jobseeker",
  });

  it("returns 400 for invalid feedback values", async () => {
    const response = await request(app)
      .patch(`/api/chat/reports/${REPORT_ID}/feedback`)
      .set(authHeader(jobseekerToken))
      .send({ feedback: "maybe" });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/helpful or false_alarm/i);
  });
});
