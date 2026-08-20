import test from "node:test";
import assert from "node:assert/strict";
import { parseWorkspaceMap } from "../scripts/backfillConversationWorkspaces.js";

test("parseWorkspaceMap accepts version 1 applications map", () => {
  const parsed = parseWorkspaceMap({
    version: 1,
    applications: {
      app1: { workspaceId: "ws-1", workspaceName: "Acme" },
      app2: { workspaceId: "ws-2" },
    },
  });

  assert.equal(parsed.version, 1);
  assert.deepEqual(parsed.applications.get("app1"), {
    workspaceId: "ws-1",
    workspaceName: "Acme",
  });
  assert.deepEqual(parsed.applications.get("app2"), {
    workspaceId: "ws-2",
    workspaceName: null,
  });
});

test("parseWorkspaceMap rejects invalid version", () => {
  assert.throws(
    () => parseWorkspaceMap({ version: 2, applications: {} }),
    /unsupported version/
  );
});

test("parseWorkspaceMap rejects invalid JSON and missing workspaceId", () => {
  assert.throws(() => parseWorkspaceMap("{"), /not valid JSON/);
  assert.throws(
    () =>
      parseWorkspaceMap({
        version: 1,
        applications: { app1: { workspaceName: "Acme" } },
      }),
    /workspaceId is required/
  );
});
