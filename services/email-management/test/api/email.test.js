import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const TEST_BEARER = "Bearer test-session-token";
const RECRUITER_ID = "recruiter-1";
const GRANT_ID = "grant-abc";
const NYLAS_CONFIG = {
  clientId: "nylas-client-id",
  apiKey: "nylas-api-key",
  redirectUri: "https://app.test/email/callback",
  apiUri: "https://api.us.nylas.com",
};

const {
  mockValidateUserSession,
  mockGetNylasGrant,
  mockSaveNylasGrant,
  mockClearNylasGrant,
  mockGetApplicationForSender,
  mockGetNylasConfig,
  mockBuildOAuthUrl,
  mockExchangeCodeForToken,
  mockSendMessage,
  mockCreateEvent,
  mockUpdateEvent,
  mockDeleteEvent,
  mockListFolders,
  mockListMessages,
  mockGetMessage,
  mockRevokeGrant,
} = vi.hoisted(() => ({
  mockValidateUserSession: vi.fn(),
  mockGetNylasGrant: vi.fn(),
  mockSaveNylasGrant: vi.fn(),
  mockClearNylasGrant: vi.fn(),
  mockGetApplicationForSender: vi.fn(),
  mockGetNylasConfig: vi.fn(),
  mockBuildOAuthUrl: vi.fn(),
  mockExchangeCodeForToken: vi.fn(),
  mockSendMessage: vi.fn(),
  mockCreateEvent: vi.fn(),
  mockUpdateEvent: vi.fn(),
  mockDeleteEvent: vi.fn(),
  mockListFolders: vi.fn(),
  mockListMessages: vi.fn(),
  mockGetMessage: vi.fn(),
  mockRevokeGrant: vi.fn(),
}));

vi.mock("../../config/userManagementClient.js", () => ({
  validateUserSession: (...args) => mockValidateUserSession(...args),
  getNylasGrant: (...args) => mockGetNylasGrant(...args),
  saveNylasGrant: (...args) => mockSaveNylasGrant(...args),
  clearNylasGrant: (...args) => mockClearNylasGrant(...args),
}));

vi.mock("../../config/jobManagementClient.js", () => ({
  getApplicationForSender: (...args) => mockGetApplicationForSender(...args),
}));

vi.mock("../../config/nylas.js", () => ({
  getNylasConfig: (...args) => mockGetNylasConfig(...args),
  buildOAuthUrl: (...args) => mockBuildOAuthUrl(...args),
  exchangeCodeForToken: (...args) => mockExchangeCodeForToken(...args),
  sendMessage: (...args) => mockSendMessage(...args),
  createEvent: (...args) => mockCreateEvent(...args),
  updateEvent: (...args) => mockUpdateEvent(...args),
  deleteEvent: (...args) => mockDeleteEvent(...args),
  listFolders: (...args) => mockListFolders(...args),
  listMessages: (...args) => mockListMessages(...args),
  getMessage: (...args) => mockGetMessage(...args),
  revokeGrant: (...args) => mockRevokeGrant(...args),
}));

import { createApp } from "../../app.js";

const authHeader = () => ({ Authorization: TEST_BEARER });

const recruiterSession = () => ({
  ok: true,
  user: {
    id: RECRUITER_ID,
    email: "hr@gmail.com",
    accountType: "recruiter",
  },
});

const connectedGrant = () => ({
  ok: true,
  connected: true,
  grantId: GRANT_ID,
  email: "hr@gmail.com",
  connectedAt: "2026-01-01T00:00:00.000Z",
});

describe("email API", () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NYLAS_STATE_SECRET = "test-state-secret";

    mockValidateUserSession.mockResolvedValue(recruiterSession());
    mockGetNylasGrant.mockResolvedValue(connectedGrant());
    mockGetNylasConfig.mockReturnValue(NYLAS_CONFIG);
    mockBuildOAuthUrl.mockReturnValue("https://api.us.nylas.com/v3/connect/auth?state=signed");
    mockSaveNylasGrant.mockResolvedValue({ ok: true });
    mockClearNylasGrant.mockResolvedValue({ ok: true });
    mockSendMessage.mockResolvedValue({});
    mockCreateEvent.mockResolvedValue({
      id: "evt-1",
      title: "Interview",
      html_link: "https://calendar.google.com/event/1",
      conferencing: {
        provider: "Google Meet",
        details: { url: "https://meet.google.com/abc-defg-hij" },
      },
    });
    mockUpdateEvent.mockResolvedValue({
      id: "evt-1",
      title: "Interview (rescheduled)",
      html_link: "https://calendar.google.com/event/1",
    });
    mockDeleteEvent.mockResolvedValue({});
    mockRevokeGrant.mockResolvedValue({});
    mockListFolders.mockResolvedValue([
      { id: "folder-inbox", name: "INBOX", unread_count: 2 },
      { id: "folder-sent", name: "Sent", total_count: 5 },
    ]);
    mockListMessages.mockResolvedValue({
      messages: [
        {
          id: "msg-1",
          subject: "Hello",
          snippet: "Hi there",
          from: [{ email: "sender@example.com" }],
          to: [{ email: "hr@gmail.com" }],
        },
      ],
      nextCursor: null,
    });
    mockGetMessage.mockResolvedValue({
      id: "msg-1",
      subject: "Hello",
      body: "Full body",
      from: [{ email: "sender@example.com" }],
      to: [{ email: "hr@gmail.com" }],
    });
  });

  describe("auth", () => {
    it("returns 401 without a session token", async () => {
      mockValidateUserSession.mockResolvedValue({
        ok: false,
        status: 401,
        message: "No token provided. Please login.",
      });

      const res = await request(app).get("/api/email/status");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("returns 403 for jobseekers", async () => {
      mockValidateUserSession.mockResolvedValue({
        ok: true,
        user: {
          id: "seeker-1",
          email: "seeker@example.com",
          accountType: "jobseeker",
        },
      });

      const res = await request(app).get("/api/email/status").set(authHeader());

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/recruiters and companies/i);
    });
  });

  describe("GET /status", () => {
    it("returns mailbox connection status", async () => {
      const res = await request(app).get("/api/email/status").set(authHeader());

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        connected: true,
        email: "hr@gmail.com",
      });
    });
  });

  describe("GET /connect", () => {
    it("returns OAuth URL for recruiters", async () => {
      const res = await request(app)
        .get("/api/email/connect")
        .query({ provider: "google" })
        .set(authHeader());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.authUrl).toContain("connect/auth");
      expect(mockBuildOAuthUrl).toHaveBeenCalled();
    });
  });

  describe("GET /callback", () => {
    it("returns 400 when authorization code is missing", async () => {
      const res = await request(app).get("/api/email/callback").set(authHeader());

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/authorization code/i);
    });

    it("completes OAuth when code and valid state are provided", async () => {
      const state = jwt.sign(
        {
          userId: RECRUITER_ID,
          returnTo: NYLAS_CONFIG.redirectUri,
          provider: "google",
        },
        process.env.NYLAS_STATE_SECRET,
        { expiresIn: "15m" }
      );

      mockExchangeCodeForToken.mockResolvedValue({
        grant_id: GRANT_ID,
        email: "hr@gmail.com",
      });

      const res = await request(app)
        .get("/api/email/callback")
        .query({ code: "oauth-code", state })
        .set(authHeader());

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        connected: true,
        email: "hr@gmail.com",
      });
      expect(mockSaveNylasGrant).toHaveBeenCalledWith(TEST_BEARER, {
        grantId: GRANT_ID,
        email: "hr@gmail.com",
      });
    });

    it("returns 403 when OAuth state user does not match session", async () => {
      const state = jwt.sign(
        { userId: "other-user", returnTo: null, provider: "google" },
        process.env.NYLAS_STATE_SECRET,
        { expiresIn: "15m" }
      );

      const res = await request(app)
        .get("/api/email/callback")
        .query({ code: "oauth-code", state })
        .set(authHeader());

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/does not match/i);
    });
  });

  describe("POST /send", () => {
    it("returns 400 when required fields are missing", async () => {
      const res = await request(app)
        .post("/api/email/send")
        .set(authHeader())
        .send({ to: "candidate@example.com" });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/to, subject, and body/i);
    });

    it("returns 400 when mailbox is not connected", async () => {
      mockGetNylasGrant.mockResolvedValue({
        ok: true,
        connected: false,
        grantId: null,
      });

      const res = await request(app)
        .post("/api/email/send")
        .set(authHeader())
        .send({
          to: "candidate@example.com",
          subject: "Update",
          body: "Hello",
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/mailbox not connected/i);
    });

    it("sends email when mailbox is connected", async () => {
      const res = await request(app)
        .post("/api/email/send")
        .set(authHeader())
        .send({
          to: "candidate@example.com",
          subject: "Interview",
          body: "See you tomorrow",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          grantId: GRANT_ID,
          to: "candidate@example.com",
          subject: "Interview",
        })
      );
    });

    it("enforces application ownership when applicationId is provided", async () => {
      mockGetApplicationForSender.mockResolvedValue({
        ok: true,
        application: {
          recruiterId: "other-recruiter",
          applicantEmail: "candidate@example.com",
        },
      });

      const res = await request(app)
        .post("/api/email/send")
        .set(authHeader())
        .send({
          to: "candidate@example.com",
          subject: "Update",
          body: "Hello",
          applicationId: "app-1",
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/job owner/i);
    });

    it("rejects recipient mismatch for application emails", async () => {
      mockGetApplicationForSender.mockResolvedValue({
        ok: true,
        application: {
          recruiterId: RECRUITER_ID,
          applicantEmail: "candidate@example.com",
        },
      });

      const res = await request(app)
        .post("/api/email/send")
        .set(authHeader())
        .send({
          to: "wrong@example.com",
          subject: "Update",
          body: "Hello",
          applicationId: "app-1",
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/does not match the application/i);
    });
  });

  describe("calendar events", () => {
    const validEventBody = {
      title: "Technical interview",
      startTime: 1700000000,
      endTime: 1700003600,
      timezone: "UTC",
      participants: [{ email: "candidate@example.com" }],
    };

    it("returns 400 when title or times are invalid on create", async () => {
      const res = await request(app)
        .post("/api/email/calendar/events")
        .set(authHeader())
        .send({ startTime: 1700000000, endTime: 1700003600 });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/title is required/i);
    });

    it("creates calendar event with conferencing", async () => {
      const res = await request(app)
        .post("/api/email/calendar/events")
        .set(authHeader())
        .send(validEventBody);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.event.conferenceUrl).toBe("https://meet.google.com/abc-defg-hij");
      expect(mockCreateEvent).toHaveBeenCalled();
    });

    it("updates calendar event times", async () => {
      const res = await request(app)
        .put("/api/email/calendar/events/evt-1")
        .set(authHeader())
        .send({
          startTime: 1700007200,
          endTime: 1700010800,
          timezone: "UTC",
        });

      expect(res.status).toBe(200);
      expect(res.body.event.id).toBe("evt-1");
      expect(mockUpdateEvent).toHaveBeenCalled();
    });

    it("deletes calendar event", async () => {
      const res = await request(app)
        .delete("/api/email/calendar/events/evt-1")
        .set(authHeader());

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/deleted/i);
      expect(mockDeleteEvent).toHaveBeenCalled();
    });
  });

  describe("folders and messages", () => {
    it("lists normalized folders", async () => {
      const res = await request(app).get("/api/email/folders").set(authHeader());

      expect(res.status).toBe(200);
      expect(res.body.folders).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: "inbox", id: "folder-inbox" }),
          expect.objectContaining({ key: "sent", id: "folder-sent" }),
        ])
      );
    });

    it("lists inbox messages", async () => {
      const res = await request(app)
        .get("/api/email/messages")
        .query({ folderKey: "inbox" })
        .set(authHeader());

      expect(res.status).toBe(200);
      expect(res.body.messages).toHaveLength(1);
      expect(res.body.messages[0].subject).toBe("Hello");
    });

    it("returns message detail by id", async () => {
      const res = await request(app)
        .get("/api/email/messages/msg-1")
        .set(authHeader());

      expect(res.status).toBe(200);
      expect(res.body.message.body).toBe("Full body");
    });
  });

  describe("DELETE /disconnect", () => {
    it("revokes grant and clears stored connection", async () => {
      const res = await request(app).delete("/api/email/disconnect").set(authHeader());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockRevokeGrant).toHaveBeenCalled();
      expect(mockClearNylasGrant).toHaveBeenCalledWith(TEST_BEARER);
    });
  });
});
