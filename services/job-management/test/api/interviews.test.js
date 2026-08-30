import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const APPLICATION_ID = "507f1f77bcf86cd799439011";
const JOB_ID = "507f1f77bcf86cd799439012";
const INTERVIEW_ID = "507f1f77bcf86cd799439013";
const WORKSPACE_ID = "507f1f77bcf86cd799439014";

const futureStart = () => new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
const futureEnd = () => new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
const pastStart = () => new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

const {
  mockValidateUserSession,
  mockApplicationFindById,
  mockJobFindById,
  mockInterviewFindOne,
  mockInterviewCreate,
  mockInterviewFindById,
  mockGetOrCreateHomeWorkspace,
  mockPublishEvent,
} = vi.hoisted(() => ({
  mockValidateUserSession: vi.fn(),
  mockApplicationFindById: vi.fn(),
  mockJobFindById: vi.fn(),
  mockInterviewFindOne: vi.fn(),
  mockInterviewCreate: vi.fn(),
  mockInterviewFindById: vi.fn(),
  mockGetOrCreateHomeWorkspace: vi.fn(),
  mockPublishEvent: vi.fn(),
}));

vi.mock("../../config/mongodb.js", () => ({ default: vi.fn() }));
vi.mock("../../config/userManagementClient.js", () => ({
  validateUserSession: (...args) => mockValidateUserSession(...args),
}));
vi.mock("../../model/applicationModel.js", () => ({
  default: {
    findById: (...args) => mockApplicationFindById(...args),
  },
}));
vi.mock("../../model/jobModel.js", () => ({
  default: {
    findById: (...args) => mockJobFindById(...args),
  },
  JOB_MODES: ["On-Site", "Remote", "Hybrid"],
  JOB_TYPES: ["Full-Time", "Part-Time", "Contract", "Internship"],
  JOB_STATUSES: ["active", "closed", "draft", "pending_review"],
}));
vi.mock("../../model/interviewModel.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: {
      findOne: (...args) => mockInterviewFindOne(...args),
      create: (...args) => mockInterviewCreate(...args),
      findById: (...args) => mockInterviewFindById(...args),
    },
  };
});
vi.mock("../../service/employerWorkspaceService.js", () => ({
  getOrCreateHomeWorkspace: (...args) => mockGetOrCreateHomeWorkspace(...args),
  WorkspaceAccessError: class WorkspaceAccessError extends Error {
    constructor(message, status = 403) {
      super(message);
      this.status = status;
    }
  },
}));
vi.mock("../../utils/publishEvent.js", () => ({
  publishEvent: (...args) => mockPublishEvent(...args),
}));
vi.mock("../../config/emailManagementClient.js", () => ({
  createCalendarEvent: vi.fn(),
  deleteCalendarEvent: vi.fn(),
  sendInviteEmail: vi.fn(),
  updateCalendarEvent: vi.fn(),
}));

import { createApp } from "../../app.js";

const authHeader = { Authorization: "Bearer test-token" };

const mockRecruiterSession = () => {
  mockValidateUserSession.mockResolvedValue({
    ok: true,
    user: {
      id: "recruiter-1",
      email: "recruiter@example.com",
      accountType: "recruiter",
    },
  });
};

const mockOwnedApplication = (overrides = {}) => ({
  _id: APPLICATION_ID,
  jobId: JOB_ID,
  applicantId: "candidate-1",
  fullName: "Jane Doe",
  email: "jane@example.com",
  status: "shortlisted",
  workspaceId: WORKSPACE_ID,
  save: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

const mockOwnedJob = (overrides = {}) => ({
  _id: JOB_ID,
  title: "Analyst",
  companyName: "Acme Ltd",
  postedBy: "recruiter-1",
  workspaceId: WORKSPACE_ID,
  contact: { website: "https://acme.com", email: "hr@acme.com" },
  ...overrides,
});

describe("POST /api/jobs/interviews", () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
    mockRecruiterSession();
    mockGetOrCreateHomeWorkspace.mockResolvedValue({ _id: WORKSPACE_ID });
    mockInterviewFindOne.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      }),
    });
  });

  it("returns 401 without auth", async () => {
    mockValidateUserSession.mockResolvedValue({
      ok: false,
      status: 401,
      message: "No token provided. Please login.",
    });

    const response = await request(app)
      .post("/api/jobs/interviews")
      .send({ applicationId: APPLICATION_ID, startsAt: futureStart() });

    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid applicationId", async () => {
    const response = await request(app)
      .post("/api/jobs/interviews")
      .set(authHeader)
      .send({ applicationId: "bad-id", startsAt: futureStart() });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/valid applicationId/i);
  });

  it("returns 400 when interview start is in the past", async () => {
    const response = await request(app)
      .post("/api/jobs/interviews")
      .set(authHeader)
      .send({
        applicationId: APPLICATION_ID,
        startsAt: pastStart(),
        endsAt: futureEnd(),
        type: "phone",
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/cannot be scheduled in the past/i);
  });

  it("returns 404 when application does not exist", async () => {
    mockApplicationFindById.mockResolvedValue(null);

    const response = await request(app)
      .post("/api/jobs/interviews")
      .set(authHeader)
      .send({
        applicationId: APPLICATION_ID,
        startsAt: futureStart(),
        endsAt: futureEnd(),
        type: "phone",
      });

    expect(response.status).toBe(404);
    expect(response.body.message).toMatch(/application not found/i);
  });

  it("returns 403 when recruiter does not own the job", async () => {
    mockApplicationFindById.mockResolvedValue(mockOwnedApplication());
    mockJobFindById.mockResolvedValue(
      mockOwnedJob({ postedBy: "someone-else" })
    );

    const response = await request(app)
      .post("/api/jobs/interviews")
      .set(authHeader)
      .send({
        applicationId: APPLICATION_ID,
        startsAt: futureStart(),
        endsAt: futureEnd(),
        type: "phone",
      });

    expect(response.status).toBe(403);
    expect(response.body.message).toMatch(/job owner/i);
  });

  it("returns 409 when an active interview already exists", async () => {
    mockApplicationFindById.mockResolvedValue(mockOwnedApplication());
    mockJobFindById.mockResolvedValue(mockOwnedJob());
    mockInterviewFindOne.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ _id: INTERVIEW_ID }),
      }),
    });

    const response = await request(app)
      .post("/api/jobs/interviews")
      .set(authHeader)
      .send({
        applicationId: APPLICATION_ID,
        startsAt: futureStart(),
        endsAt: futureEnd(),
        type: "phone",
      });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("INTERVIEW_ALREADY_EXISTS");
    expect(response.body.existingInterviewId).toBe(INTERVIEW_ID);
  });

  it("creates a phone interview successfully", async () => {
    const application = mockOwnedApplication();
    mockApplicationFindById.mockResolvedValue(application);
    mockJobFindById.mockResolvedValue(mockOwnedJob());

    const createdInterview = {
      _id: INTERVIEW_ID,
      workspaceId: WORKSPACE_ID,
      jobId: JOB_ID,
      applicationId: APPLICATION_ID,
      candidateUserId: "candidate-1",
      organizerId: "recruiter-1",
      candidateName: "Jane Doe",
      candidateEmail: "jane@example.com",
      jobTitle: "Analyst",
      companyName: "Acme Ltd",
      startsAt: new Date(futureStart()),
      endsAt: new Date(futureEnd()),
      timezone: "UTC",
      type: "phone",
      location: "",
      notes: "",
      status: "scheduled",
      conferenceProvider: null,
      conferenceUrl: null,
      calendarEventId: null,
      calendarId: "primary",
      calendarHtmlLink: null,
      inviteEmailSent: false,
      createdAt: new Date("2026-08-29T10:00:00.000Z"),
      updatedAt: new Date("2026-08-29T10:00:00.000Z"),
      save: vi.fn().mockResolvedValue(undefined),
    };

    mockInterviewCreate.mockResolvedValue(createdInterview);

    const response = await request(app)
      .post("/api/jobs/interviews")
      .set(authHeader)
      .send({
        applicationId: APPLICATION_ID,
        startsAt: futureStart(),
        endsAt: futureEnd(),
        type: "phone",
        addConferencing: false,
        sendInvite: false,
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.interview.id).toBe(INTERVIEW_ID);
    expect(response.body.interview.type).toBe("phone");
    expect(application.status).toBe("interview");
    expect(application.save).toHaveBeenCalled();
    expect(mockPublishEvent).toHaveBeenCalled();
  });
});

describe("PATCH /api/jobs/interviews/:interviewId", () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
    mockRecruiterSession();
  });

  it("returns 400 when rescheduling to a past start time", async () => {
    const interview = {
      _id: INTERVIEW_ID,
      organizerId: "recruiter-1",
      status: "scheduled",
      startsAt: new Date(futureStart()),
      endsAt: new Date(futureEnd()),
      timezone: "UTC",
      calendarEventId: null,
      save: vi.fn().mockResolvedValue(undefined),
    };
    mockInterviewFindById.mockResolvedValue(interview);

    const response = await request(app)
      .patch(`/api/jobs/interviews/${INTERVIEW_ID}`)
      .set(authHeader)
      .send({ startsAt: pastStart() });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/cannot be scheduled in the past/i);
  });

  it("returns 400 when rescheduling a cancelled interview", async () => {
    mockInterviewFindById.mockResolvedValue({
      _id: INTERVIEW_ID,
      organizerId: "recruiter-1",
      status: "cancelled",
      startsAt: new Date(futureStart()),
      endsAt: new Date(futureEnd()),
      timezone: "UTC",
    });

    const response = await request(app)
      .patch(`/api/jobs/interviews/${INTERVIEW_ID}`)
      .set(authHeader)
      .send({ startsAt: futureStart(), endsAt: futureEnd() });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/cancelled interview/i);
  });
});

describe("POST /api/jobs/interviews/:interviewId/cancel", () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
    mockRecruiterSession();
  });

  it("cancels an interview and reverts application status", async () => {
    const interview = {
      _id: INTERVIEW_ID,
      organizerId: "recruiter-1",
      status: "scheduled",
      applicationId: APPLICATION_ID,
      jobId: JOB_ID,
      candidateUserId: "candidate-1",
      candidateName: "Jane Doe",
      candidateEmail: "jane@example.com",
      jobTitle: "Analyst",
      companyName: "Acme Ltd",
      startsAt: new Date(futureStart()),
      endsAt: new Date(futureEnd()),
      timezone: "UTC",
      type: "phone",
      location: "",
      notes: "",
      calendarEventId: null,
      calendarId: "primary",
      inviteEmailSent: false,
      createdAt: new Date("2026-08-29T10:00:00.000Z"),
      updatedAt: new Date("2026-08-29T10:00:00.000Z"),
      save: vi.fn().mockResolvedValue(undefined),
    };

    const application = mockOwnedApplication({ status: "interview" });

    mockInterviewFindById.mockResolvedValue(interview);
    mockApplicationFindById.mockResolvedValue(application);
    mockJobFindById.mockResolvedValue(mockOwnedJob());

    const response = await request(app)
      .post(`/api/jobs/interviews/${INTERVIEW_ID}/cancel`)
      .set(authHeader)
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(interview.status).toBe("cancelled");
    expect(application.status).toBe("shortlisted");
    expect(mockPublishEvent).toHaveBeenCalled();
  });
});
