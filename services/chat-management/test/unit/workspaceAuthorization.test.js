import http from "http";
import { afterEach, describe, expect, it } from "vitest";
import {
  authorizeConversation,
  buildConversationEventContext,
  getAuthorizedConversation,
  isEmployerAccount,
  normalizeWorkspaceId,
  validateWorkspaceMembership,
} from "../../utils/workspaceAuthorization.js";

const workspaceConversation = {
  recruiterId: "employer-1",
  jobseekerId: "jobseeker-1",
  workspaceId: "workspace-1",
};

describe("isEmployerAccount", () => {
  it("treats recruiter and company as employer accounts", () => {
    expect(isEmployerAccount("recruiter")).toBe(true);
    expect(isEmployerAccount("company")).toBe(true);
    expect(isEmployerAccount("jobseeker")).toBe(false);
  });
});

describe("normalizeWorkspaceId", () => {
  it("trims workspace ids and returns empty string for missing values", () => {
    expect(normalizeWorkspaceId("  ws-1  ")).toBe("ws-1");
    expect(normalizeWorkspaceId(null)).toBe("");
  });
});

describe("buildConversationEventContext", () => {
  it("includes only active workspace members", () => {
    const context = buildConversationEventContext(workspaceConversation, {
      workspace: {
        members: [
          { userId: "employer-1", status: "active" },
          { userId: "employer-2", status: "invited" },
        ],
      },
    });

    expect(context.workspaceMemberIds).toEqual(["employer-1"]);
  });
});

describe("authorizeConversation", () => {
  it("allows jobseeker access without a workspace header", async () => {
    const result = await authorizeConversation({
      conversation: workspaceConversation,
      userId: "jobseeker-1",
      accountType: "jobseeker",
    });
    expect(result.ok).toBe(true);
    expect(result.role).toBe("jobseeker");
  });

  it("denies unrelated jobseekers", async () => {
    const result = await authorizeConversation({
      conversation: workspaceConversation,
      userId: "jobseeker-2",
      accountType: "jobseeker",
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
  });

  it("requires matching workspace for employer access", async () => {
    const missing = await authorizeConversation({
      conversation: workspaceConversation,
      userId: "employer-1",
      accountType: "recruiter",
    });
    expect(missing.status).toBe(400);

    const mismatch = await authorizeConversation({
      conversation: workspaceConversation,
      userId: "employer-1",
      accountType: "recruiter",
      workspaceId: "workspace-2",
    });
    expect(mismatch.status).toBe(403);
  });

  it("allows legacy conversations for the owning recruiter only", async () => {
    const legacyConversation = {
      recruiterId: "employer-1",
      jobseekerId: "jobseeker-1",
      workspaceId: null,
    };
    const owner = await authorizeConversation({
      conversation: legacyConversation,
      userId: "employer-1",
      accountType: "company",
    });
    const otherEmployer = await authorizeConversation({
      conversation: legacyConversation,
      userId: "employer-2",
      accountType: "company",
    });

    expect(owner.ok).toBe(true);
    expect(owner.legacy).toBe(true);
    expect(otherEmployer.status).toBe(403);
  });
});

describe("validateWorkspaceMembership", () => {
  let server;
  let previousBaseUrl;

  afterEach(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      server = null;
    }
    if (previousBaseUrl === undefined) {
      delete process.env.JOB_MANAGEMENT_BASE_URL;
    } else {
      process.env.JOB_MANAGEMENT_BASE_URL = previousBaseUrl;
    }
  });

  it("forwards auth and caches workspace lookups", async () => {
    let requests = 0;
    server = http.createServer((req, res) => {
      requests += 1;
      expect(req.url).toBe("/api/jobs/workspaces/workspace-1");
      expect(req.headers.authorization).toBe("Bearer test-token");
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          success: true,
          workspace: {
            id: "workspace-1",
            members: [{ userId: "employer-1", status: "active" }],
          },
        })
      );
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

    previousBaseUrl = process.env.JOB_MANAGEMENT_BASE_URL;
    process.env.JOB_MANAGEMENT_BASE_URL =
      `http://127.0.0.1:${server.address().port}`;

    const cache = new Map();
    const first = await validateWorkspaceMembership({
      workspaceId: "workspace-1",
      authorizationHeader: "Bearer test-token",
      cache,
    });
    const second = await validateWorkspaceMembership({
      workspaceId: "workspace-1",
      authorizationHeader: "Bearer test-token",
      cache,
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(requests).toBe(1);
  });
});

describe("getAuthorizedConversation", () => {
  it("returns 400 for invalid conversation ids", async () => {
    const result = await getAuthorizedConversation({
      conversationId: "bad-id",
      userId: "jobseeker-1",
      accountType: "jobseeker",
    });
    expect(result.status).toBe(400);
  });
});
