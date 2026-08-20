import { randomUUID } from "node:crypto";
import { rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import "dotenv/config";
import connectDB from "../config/mongodb.js";
import Application from "../model/applicationModel.js";
import EmployerWorkspace from "../model/employerWorkspaceModel.js";
import Job from "../model/jobModel.js";
import { normalizeWorkspaceName } from "../service/employerWorkspaceService.js";

const hasNoWorkspace = {
  $or: [
    { workspaceId: { $exists: false } },
    { workspaceId: null },
    { workspaceId: "" },
  ],
};

const hasWorkspaceId = {
  workspaceId: { $exists: true, $nin: [null, ""] },
};

const parseOutputPath = (argv = process.argv.slice(2)) => {
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--output") {
      const value = argv[i + 1];
      if (!value || value.startsWith("-")) {
        throw new Error("Missing value for --output. Usage: --output <path>");
      }
      return value;
    }
    if (arg.startsWith("--output=")) {
      const value = arg.slice("--output=".length).trim();
      if (!value) {
        throw new Error("Missing value for --output=. Usage: --output=<path>");
      }
      return value;
    }
  }
  return null;
};

const resolveOutputPath = (rawPath) => {
  const resolved = path.resolve(process.cwd(), rawPath);
  if (!path.basename(resolved)) {
    throw new Error(`Invalid --output path: ${rawPath}`);
  }
  return resolved;
};

const assertParentDirectoryExists = async (outputPath) => {
  const parentDir = path.dirname(outputPath);
  try {
    const parentStats = await stat(parentDir);
    if (!parentStats.isDirectory()) {
      throw new Error(`Output parent path is not a directory: ${parentDir}`);
    }
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(
        `Output parent directory does not exist: ${parentDir}. Create it first.`
      );
    }
    throw error;
  }
  return parentDir;
};

const writeJsonAtomically = async (outputPath, payload) => {
  const parentDir = await assertParentDirectoryExists(outputPath);
  const tempPath = path.join(
    parentDir,
    `.${path.basename(outputPath)}.${process.pid}.${Date.now()}.tmp`
  );

  try {
    await writeFile(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    await rename(tempPath, outputPath);
  } catch (error) {
    try {
      await unlink(tempPath);
    } catch {
      // Best-effort cleanup of the temp file.
    }
    throw error;
  }
};

const exportApplicationWorkspaceMapping = async (outputPath) => {
  const applicationDocs = await Application.find(hasWorkspaceId, {
    workspaceId: 1,
    jobId: 1,
  }).lean();

  const workspaceIds = [
    ...new Set(
      applicationDocs
        .map((application) => String(application.workspaceId || "").trim())
        .filter(Boolean)
    ),
  ];
  const jobIds = [
    ...new Set(
      applicationDocs
        .map((application) => application.jobId)
        .filter(Boolean)
        .map((jobId) => String(jobId))
    ),
  ];

  const [workspaces, jobs] = await Promise.all([
    workspaceIds.length
      ? EmployerWorkspace.find({ _id: { $in: workspaceIds } }, { name: 1 }).lean()
      : [],
    jobIds.length
      ? Job.find({ _id: { $in: jobIds } }, { companyName: 1 }).lean()
      : [],
  ]);

  const workspaceNameById = new Map(
    workspaces.map((workspace) => [
      String(workspace._id),
      String(workspace.name || "").trim(),
    ])
  );
  const jobCompanyNameById = new Map(
    jobs.map((job) => [
      String(job._id),
      String(job.companyName || "").trim(),
    ])
  );

  const applications = {};
  for (const application of applicationDocs) {
    const applicationId = String(application._id);
    const workspaceId = String(application.workspaceId || "").trim();
    if (!workspaceId) continue;

    const workspaceName =
      workspaceNameById.get(workspaceId) ||
      jobCompanyNameById.get(String(application.jobId || "")) ||
      "";

    applications[applicationId] = {
      workspaceId,
      workspaceName,
    };
  }

  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    applications,
  };

  await writeJsonAtomically(outputPath, payload);
  return Object.keys(applications).length;
};

const run = async () => {
  const rawOutputPath = parseOutputPath();
  const outputPath = rawOutputPath ? resolveOutputPath(rawOutputPath) : null;
  if (outputPath) {
    // Fail early if the parent directory is missing before mutating data.
    await assertParentDirectoryExists(outputPath);
  }

  await connectDB();

  const groups = new Map();
  const cursor = Job.find(
    {},
    { postedBy: 1, companyName: 1, companyLogo: 1, workspaceId: 1 }
  ).cursor();

  for await (const job of cursor) {
    const ownerId = String(job.postedBy || "").trim();
    const name = String(job.companyName || "").trim().replace(/\s+/g, " ");
    const normalizedName = normalizeWorkspaceName(name);

    if (!ownerId || !normalizedName) {
      console.warn(`Skipping job ${job._id}: owner or company name is missing`);
      continue;
    }

    const key = `${ownerId}\u0000${normalizedName}`;
    const group = groups.get(key) || {
      ownerId,
      name,
      normalizedName,
      logo: null,
      jobs: [],
    };
    if (!group.logo && job.companyLogo) group.logo = job.companyLogo;
    group.jobs.push(job);
    groups.set(key, group);
  }

  let workspacesCreated = 0;
  let jobsUpdated = 0;
  let applicationsUpdated = 0;

  for (const group of groups.values()) {
    let workspace = await EmployerWorkspace.findOne({
      ownerId: group.ownerId,
      normalizedName: group.normalizedName,
    });

    if (!workspace) {
      try {
        workspace = await EmployerWorkspace.create({
          _id: randomUUID(),
          ownerId: group.ownerId,
          name: group.name,
          normalizedName: group.normalizedName,
          logo: group.logo,
          members: [
            {
              userId: group.ownerId,
              role: "owner",
              status: "active",
            },
          ],
        });
        workspacesCreated += 1;
      } catch (error) {
        if (error?.code !== 11000) throw error;
        workspace = await EmployerWorkspace.findOne({
          ownerId: group.ownerId,
          normalizedName: group.normalizedName,
        });
        if (!workspace) throw error;
      }
    }

    const missingJobIds = group.jobs
      .filter((job) => !job.workspaceId)
      .map((job) => job._id);

    if (missingJobIds.length) {
      const jobResult = await Job.updateMany(
        {
          _id: { $in: missingJobIds },
          ...hasNoWorkspace,
        },
        { $set: { workspaceId: String(workspace._id) } }
      );
      jobsUpdated += jobResult.modifiedCount;
    }

    const jobIdsByWorkspace = new Map();
    for (const job of group.jobs) {
      const targetWorkspaceId = String(job.workspaceId || workspace._id);
      const jobIds = jobIdsByWorkspace.get(targetWorkspaceId) || [];
      jobIds.push(job._id);
      jobIdsByWorkspace.set(targetWorkspaceId, jobIds);
    }

    for (const [targetWorkspaceId, jobIds] of jobIdsByWorkspace) {
      const applicationResult = await Application.updateMany(
        {
          jobId: { $in: jobIds },
          workspaceId: { $ne: targetWorkspaceId },
        },
        { $set: { workspaceId: targetWorkspaceId } }
      );
      applicationsUpdated += applicationResult.modifiedCount;
    }
  }

  console.log(
    `Workspace migration complete: ${workspacesCreated} created, ` +
      `${jobsUpdated} jobs updated, ${applicationsUpdated} applications updated`
  );

  if (outputPath) {
    const exportedCount = await exportApplicationWorkspaceMapping(outputPath);
    console.log(
      `Exported ${exportedCount} application workspace mappings to ${outputPath}`
    );
  }
};

try {
  await run();
} catch (error) {
  console.error("Workspace migration failed:", error.message || error);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
