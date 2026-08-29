import { describe, expect, it } from "vitest";
import { parseWorkspaceMap } from "../../scripts/backfillConversationWorkspaces.js";

describe("parseWorkspaceMap", () => {
  it("accepts version 1 applications map", () => {
    const parsed = parseWorkspaceMap({
      version: 1,
      applications: {
        app1: { workspaceId: "ws-1", workspaceName: "Acme" },
        app2: { workspaceId: "ws-2" },
      },
    });

    expect(parsed.version).toBe(1);
    expect(parsed.applications.get("app1")).toEqual({
      workspaceId: "ws-1",
      workspaceName: "Acme",
    });
    expect(parsed.applications.get("app2")).toEqual({
      workspaceId: "ws-2",
      workspaceName: null,
    });
  });

  it("rejects invalid version", () => {
    expect(() => parseWorkspaceMap({ version: 2, applications: {} })).toThrow(
      /unsupported version/
    );
  });

  it("rejects invalid JSON and missing workspaceId", () => {
    expect(() => parseWorkspaceMap("{")).toThrow(/not valid JSON/);
    expect(() =>
      parseWorkspaceMap({
        version: 1,
        applications: { app1: { workspaceName: "Acme" } },
      })
    ).toThrow(/workspaceId is required/);
  });
});
