import { beforeEach, describe, expect, it, vi } from "vitest";
import { EVENT_TYPES } from "../../constants/eventTypes.js";

const {
  mockNotificationCreate,
  mockNotificationFindOne,
  mockSendThankYouEmail,
  mockSendStatusEmail,
  mockSendInterviewEmail,
  mockSendExpoPush,
  mockListSuperadmins,
  mockFindJobseekers,
} = vi.hoisted(() => ({
  mockNotificationCreate: vi.fn(),
  mockNotificationFindOne: vi.fn(),
  mockSendThankYouEmail: vi.fn(),
  mockSendStatusEmail: vi.fn(),
  mockSendInterviewEmail: vi.fn(),
  mockSendExpoPush: vi.fn(),
  mockListSuperadmins: vi.fn(),
  mockFindJobseekers: vi.fn(),
}));

vi.mock("../../model/notificationModel.js", () => ({
  default: {
    create: (...args) => mockNotificationCreate(...args),
    findOne: (...args) => mockNotificationFindOne(...args),
  },
}));
vi.mock("../../utils/sendApplicationThankYouEmail.js", () => ({
  sendApplicationThankYouEmail: (...args) => mockSendThankYouEmail(...args),
}));
vi.mock("../../utils/sendApplicationStatusEmail.js", () => ({
  sendApplicationStatusEmail: (...args) => mockSendStatusEmail(...args),
}));
vi.mock("../../utils/sendInterviewReminderEmail.js", () => ({
  sendInterviewReminderEmail: (...args) => mockSendInterviewEmail(...args),
}));
vi.mock("../../utils/expoPushClient.js", () => ({
  sendExpoPushToUser: (...args) => mockSendExpoPush(...args),
}));
vi.mock("../../utils/userManagementClient.js", () => ({
  listSuperadmins: (...args) => mockListSuperadmins(...args),
  findJobseekersMatchingSkills: (...args) => mockFindJobseekers(...args),
}));

import { handleEvent } from "../../handlers/eventHandlers.js";

const baseApplicationPayload = {
  applicationId: "app-1",
  applicantId: "user-1",
  jobId: "job-1",
  jobTitle: "Analyst",
  companyName: "Acme Ltd",
  applicantEmail: "jane@example.com",
  applicantName: "Jane Doe",
  status: "applied",
};

const setupFindOne = ({
  processedEvent = false,
  existingApplicationNotification = null,
} = {}) => {
  mockNotificationFindOne.mockImplementation((query) => {
    if (Object.prototype.hasOwnProperty.call(query, "sourceEventId")) {
      return {
        select: vi.fn().mockResolvedValue(processedEvent ? { _id: "seen" } : null),
      };
    }
    if (query["metadata.applicationId"]) {
      return Promise.resolve(existingApplicationNotification);
    }
    if (query.userId && query.type === "job") {
      return { select: vi.fn().mockResolvedValue(null) };
    }
    return Promise.resolve(null);
  });
};

describe("handleEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendThankYouEmail.mockResolvedValue({ sent: true });
    mockSendStatusEmail.mockResolvedValue({ sent: true });
    mockSendInterviewEmail.mockResolvedValue({ sent: true });
    mockSendExpoPush.mockResolvedValue({ sent: true });
    mockListSuperadmins.mockResolvedValue([]);
    mockFindJobseekers.mockResolvedValue([]);
    mockNotificationCreate.mockResolvedValue({ _id: "notif-1" });
    setupFindOne();
  });

  it("throws when eventType is missing", async () => {
    await expect(handleEvent({})).rejects.toThrow(/eventType/i);
  });

  it("skips unsupported event types", async () => {
    const result = await handleEvent({ eventType: "unknown.event" });
    expect(result).toEqual({ skipped: true, reason: "unsupported-event" });
  });

  it("skips duplicate application.created events", async () => {
    setupFindOne({ processedEvent: true });

    const result = await handleEvent({
      eventType: EVENT_TYPES.APPLICATION_CREATED,
      eventId: "evt-dup",
      payload: baseApplicationPayload,
    });

    expect(result).toEqual({ skipped: true, reason: "duplicate-event" });
    expect(mockNotificationCreate).not.toHaveBeenCalled();
  });

  it("creates an application notification and sends thank-you email", async () => {
    const result = await handleEvent({
      eventType: EVENT_TYPES.APPLICATION_CREATED,
      eventId: "evt-1",
      payload: baseApplicationPayload,
    });

    expect(result.created).toBe(true);
    expect(mockNotificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        category: "applications",
        type: "application",
        title: "Application Submitted",
      })
    );
    expect(mockSendThankYouEmail).toHaveBeenCalled();
  });

  it("updates an existing application notification on status change", async () => {
    const existing = {
      title: "Old",
      body: "Old body",
      metadata: {},
      read: true,
      save: vi.fn().mockResolvedValue(undefined),
    };
    setupFindOne({ existingApplicationNotification: existing });

    const result = await handleEvent({
      eventType: EVENT_TYPES.APPLICATION_STATUS_UPDATED,
      eventId: "evt-2",
      payload: {
        ...baseApplicationPayload,
        status: "shortlisted",
      },
    });

    expect(result.updated).toBe(true);
    expect(existing.title).toBe("You've Been Shortlisted");
    expect(existing.read).toBe(false);
    expect(existing.save).toHaveBeenCalled();
    expect(mockSendStatusEmail).not.toHaveBeenCalled();
  });

  it("sends status email for offered applications", async () => {
    const result = await handleEvent({
      eventType: EVENT_TYPES.APPLICATION_STATUS_UPDATED,
      eventId: "evt-3",
      payload: {
        ...baseApplicationPayload,
        status: "offered",
      },
    });

    expect(result.created).toBe(true);
    expect(mockSendStatusEmail).toHaveBeenCalledWith(
      expect.objectContaining({ status: "offered" })
    );
  });

  it("creates auth notifications for password updates", async () => {
    const result = await handleEvent({
      eventType: EVENT_TYPES.AUTH_PASSWORD_UPDATED,
      eventId: "evt-4",
      payload: { userId: "user-1" },
    });

    expect(result.created).toBe(true);
    expect(mockNotificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "auth",
        title: "Password Updated",
      })
    );
  });

  it("sends push only for normal chat messages", async () => {
    const result = await handleEvent({
      eventType: EVENT_TYPES.CHAT_MESSAGE_CREATED,
      eventId: "evt-5",
      payload: {
        recipientId: "user-1",
        conversationId: "conv-1",
        preview: "Hello there",
        flagged: false,
      },
    });

    expect(result.skippedInbox).toBe(true);
    expect(result.created).toBe(false);
    expect(mockSendExpoPush).toHaveBeenCalled();
    expect(mockNotificationCreate).not.toHaveBeenCalled();
  });

  it("creates inbox notification for flagged chat messages", async () => {
    const result = await handleEvent({
      eventType: EVENT_TYPES.CHAT_MESSAGE_CREATED,
      eventId: "evt-6",
      payload: {
        recipientId: "user-1",
        conversationId: "conv-1",
        preview: "Pay upfront fee",
        flagged: true,
        companyName: "Acme Ltd",
      },
    });

    expect(result.created).toBe(true);
    expect(mockNotificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "scam",
        title: "Possible scam message",
      })
    );
  });

  it("skips job.created when the job has no skills", async () => {
    const result = await handleEvent({
      eventType: EVENT_TYPES.JOB_CREATED,
      eventId: "evt-7",
      payload: { jobId: "job-1", skills: [] },
    });

    expect(result).toEqual({ skipped: true, reason: "no-job-skills" });
  });

  it("notifies matching jobseekers for job.created", async () => {
    mockFindJobseekers.mockResolvedValue([
      { id: "seeker-1", matchedSkills: ["python", "sql"] },
    ]);

    const result = await handleEvent({
      eventType: EVENT_TYPES.JOB_CREATED,
      eventId: "evt-8",
      payload: {
        jobId: "job-1",
        jobTitle: "Python Developer",
        companyName: "Acme Ltd",
        skills: ["python", "django"],
      },
    });

    expect(result.createdCount).toBe(1);
    expect(mockNotificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "seeker-1",
        type: "job",
      })
    );
  });

  it("creates interview reminder notification and email", async () => {
    const result = await handleEvent({
      eventType: EVENT_TYPES.INTERVIEW_REMINDER,
      eventId: "evt-9",
      payload: {
        interviewId: "int-1",
        applicantId: "user-1",
        jobTitle: "Analyst",
        candidateEmail: "jane@example.com",
        startsAt: "2026-09-01T10:00:00.000Z",
      },
    });

    expect(result.created).toBe(true);
    expect(mockSendInterviewEmail).toHaveBeenCalled();
    expect(mockSendExpoPush).toHaveBeenCalled();
  });

  it("notifies superadmins when a support ticket is created", async () => {
    mockListSuperadmins.mockResolvedValue([{ id: "admin-1" }]);

    const result = await handleEvent({
      eventType: EVENT_TYPES.SUPPORT_TICKET_CREATED,
      eventId: "evt-10",
      payload: {
        ticketId: "ticket-1",
        ticketNumber: "TK-001",
        subject: "Login issue",
        requesterName: "Jane",
      },
    });

    expect(result.createdCount).toBe(1);
    expect(mockNotificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "admin-1",
        type: "support",
      })
    );
  });

  it("notifies requester when support replies", async () => {
    const result = await handleEvent({
      eventType: EVENT_TYPES.SUPPORT_TICKET_REPLIED,
      eventId: "evt-11",
      payload: {
        ticketId: "ticket-1",
        ticketNumber: "TK-001",
        requesterUserId: "user-1",
        adminName: "Support Team",
        replyPreview: "We reset your password",
      },
    });

    expect(result.created).toBe(true);
    expect(mockNotificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        type: "support",
        title: "Support replied to your ticket",
      })
    );
  });
});
