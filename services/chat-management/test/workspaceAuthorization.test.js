import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import {
  authorizeConversation,
  validateWorkspaceMembership,
} from "../utils/workspaceAuthorization.js";

const workspaceConversation = {
  recruiterId: "employer-1",
  jobseekerId: "jobseeker-1",
  workspaceId: "workspace-1",
};

test("jobseeker access does not require a workspace header", async () => {
  const result = await authorizeConversation({
    conversation: workspaceConversation,
    userId: "jobseeker-1",
    accountType: "jobseeker",
  });
  assert.equal(result.ok, true);
  assert.equal(result.role, "jobseeker");
});

test("unrelated jobseekers are denied", async () => {
  const result = await authorizeConversation({
    conversation: workspaceConversation,
    userId: "jobseeker-2",
    accountType: "jobseeker",
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 403);
});

test("workspace employer access requires the matching workspace", async () => {
  const missing = await authorizeConversation({
    conversation: workspaceConversation,
    userId: "employer-1",
    accountType: "recruiter",
  });
  assert.equal(missing.status, 400);

  const mismatch = await authorizeConversation({
    conversation: workspaceConversation,
    userId: "employer-1",
    accountType: "recruiter",
    workspaceId: "workspace-2",
  });
  assert.equal(mismatch.status, 403);
});

test("legacy conversations retain exact recruiter access", async () => {
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

  assert.equal(owner.ok, true);
  assert.equal(owner.legacy, true);
  assert.equal(otherEmployer.status, 403);
});

test("workspace membership validation forwards auth and caches", async (t) => {
  let requests = 0;
  const server = http.createServer((req, res) => {
    requests += 1;
    assert.equal(req.url, "/api/jobs/workspaces/workspace-1");
    assert.equal(req.headers.authorization, "Bearer test-token");
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
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const previousBaseUrl = process.env.JOB_MANAGEMENT_BASE_URL;
  process.env.JOB_MANAGEMENT_BASE_URL =
    `http://127.0.0.1:${server.address().port}`;
  t.after(() => {
    if (previousBaseUrl === undefined) {
      delete process.env.JOB_MANAGEMENT_BASE_URL;
    } else {
      process.env.JOB_MANAGEMENT_BASE_URL = previousBaseUrl;
    }
  });

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

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(requests, 1);
});
