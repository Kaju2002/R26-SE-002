import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import mongoose from "mongoose";
import connectDB from "../config/mongodb.js";
import Conversation from "../model/conversationModel.js";
import { fetchApplication } from "../utils/jobManagementClient.js";

const readArg = (name) => {
  const inline = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(`${name}=`.length).trim();
  const index = process.argv.indexOf(name);
  if (index >= 0) return String(process.argv[index + 1] || "").trim();
  return "";
};

const readToken = () => {
  const fromArg = readArg("--token");
  if (fromArg) return fromArg;
  return String(process.env.ADMIN_BEARER_TOKEN || "").trim();
};

/**
 * Parse and validate job migration JSON:
 * { version: 1, applications: { [applicationId]: { workspaceId, workspaceName } } }
 */
export const parseWorkspaceMap = (raw, sourceLabel = "map") => {
  let data;
  try {
    data = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch (error) {
    throw new Error(`Invalid ${sourceLabel}: not valid JSON (${error.message})`);
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error(`Invalid ${sourceLabel}: expected a JSON object`);
  }

  if (data.version !== 1) {
    throw new Error(
      `Invalid ${sourceLabel}: unsupported version ${JSON.stringify(data.version)} (expected 1)`
    );
  }

  if (
    !data.applications ||
    typeof data.applications !== "object" ||
    Array.isArray(data.applications)
  ) {
    throw new Error(
      `Invalid ${sourceLabel}: applications must be an object keyed by applicationId`
    );
  }

  const applications = new Map();
  for (const [applicationId, entry] of Object.entries(data.applications)) {
    const id = String(applicationId || "").trim();
    if (!id) {
      throw new Error(`Invalid ${sourceLabel}: empty applicationId key`);
    }
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(
        `Invalid ${sourceLabel}: applications["${id}"] must be an object`
      );
    }

    const workspaceId = String(entry.workspaceId || "").trim();
    if (!workspaceId) {
      throw new Error(
        `Invalid ${sourceLabel}: applications["${id}"].workspaceId is required`
      );
    }

    const workspaceName =
      entry.workspaceName == null || entry.workspaceName === ""
        ? null
        : String(entry.workspaceName).trim() || null;

    applications.set(id, { workspaceId, workspaceName });
  }

  return { version: 1, applications };
};

export const loadWorkspaceMapFile = (mapPath) => {
  const resolved = path.resolve(String(mapPath || "").trim());
  if (!resolved) {
    throw new Error("Map path is required");
  }
  if (!fs.existsSync(resolved)) {
    throw new Error(`Map file not found: ${resolved}`);
  }

  let raw;
  try {
    raw = fs.readFileSync(resolved, "utf8");
  } catch (error) {
    throw new Error(`Could not read map file ${resolved}: ${error.message}`);
  }

  return parseWorkspaceMap(raw, resolved);
};

const missingWorkspaceFilter = {
  $or: [
    { workspaceId: null },
    { workspaceId: "" },
    { workspaceId: { $exists: false } },
  ],
};

const applyWorkspaceUpdate = async (conversationId, workspaceId, workspaceName) => {
  const update = await Conversation.updateOne(
    {
      _id: conversationId,
      ...missingWorkspaceFilter,
    },
    {
      $set: {
        workspaceId,
        workspaceName: workspaceName || null,
      },
    }
  );
  return update.modifiedCount;
};

const runWithMap = async (mapPath) => {
  const { applications } = loadWorkspaceMapFile(mapPath);

  let updated = 0;
  let missingMapping = 0;
  let failed = 0;

  const cursor = Conversation.find(missingWorkspaceFilter).cursor();

  for await (const conversation of cursor) {
    const applicationId = String(conversation.applicationId || "").trim();
    const mapped = applications.get(applicationId);

    if (!mapped) {
      missingMapping += 1;
      console.warn(
        `Missing map entry for conversation ${conversation._id} applicationId=${applicationId}`
      );
      continue;
    }

    try {
      updated += await applyWorkspaceUpdate(
        conversation._id,
        mapped.workspaceId,
        mapped.workspaceName
      );
    } catch (error) {
      failed += 1;
      console.error(
        `Failed conversation ${conversation._id}: ${error.message}`
      );
    }
  }

  console.log(
    `Backfill complete (map): updated=${updated} missingMapping=${missingMapping} failed=${failed}`
  );
  if (failed) process.exitCode = 2;
};

const runWithToken = async (token) => {
  const authorizationHeader = token.startsWith("Bearer ")
    ? token
    : `Bearer ${token}`;

  let updated = 0;
  let skippedWithoutWorkspace = 0;
  let failed = 0;

  const cursor = Conversation.find(missingWorkspaceFilter).cursor();

  for await (const conversation of cursor) {
    const result = await fetchApplication(
      conversation.applicationId,
      authorizationHeader
    );
    if (!result.ok) {
      failed += 1;
      console.error(
        `Failed conversation ${conversation._id}: ${result.status} ${result.message}`
      );
      continue;
    }

    const workspaceId = String(result.application.workspaceId || "").trim();
    if (!workspaceId) {
      skippedWithoutWorkspace += 1;
      continue;
    }

    const workspaceName = result.application.companyName
      ? String(result.application.companyName)
      : null;

    try {
      updated += await applyWorkspaceUpdate(
        conversation._id,
        workspaceId,
        workspaceName
      );
    } catch (error) {
      failed += 1;
      console.error(
        `Failed conversation ${conversation._id}: ${error.message}`
      );
    }
  }

  console.log(
    `Backfill complete: updated=${updated} legacyWithoutWorkspace=${skippedWithoutWorkspace} failed=${failed}`
  );
  if (failed) process.exitCode = 2;
};

const isMainModule = () => {
  const entry = process.argv[1];
  if (!entry) return false;
  return pathToFileURL(path.resolve(entry)).href === import.meta.url;
};

const main = async () => {
  const mapPath = readArg("--map");
  const token = readToken();

  if (!mapPath && !token) {
    console.error(
      "Provide --map <path> or --token <JWT> (or ADMIN_BEARER_TOKEN)"
    );
    process.exit(1);
  }

  await connectDB();

  try {
    if (mapPath) {
      await runWithMap(mapPath);
    } else {
      await runWithToken(token);
    }
  } catch (error) {
    console.error(error.message || error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

if (isMainModule()) {
  await main();
}
