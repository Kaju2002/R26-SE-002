import { classifyJobPostText } from "./fakeJobDetectionClient.js";

const asLines = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean).join("\n");
  }
  return String(value || "").trim();
};

export const buildJobRiskText = (job = {}) =>
  [
    `Title: ${job.title || ""}`,
    `Company: ${job.companyName || ""}`,
    `Location: ${job.location || ""}`,
    asLines(job.description) ? `Description:\n${asLines(job.description)}` : "",
    asLines(job.requirements) ? `Requirements:\n${asLines(job.requirements)}` : "",
    asLines(job.skills)
      ? `Skills: ${Array.isArray(job.skills) ? job.skills.join(", ") : asLines(job.skills)}`
      : "",
    asLines(job.about) ? `About:\n${asLines(job.about)}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

export const applyRiskDecision = (requestedStatus, risk) => {
  const prediction = String(risk?.prediction || "error").toLowerCase();
  const isLegitimate = prediction === "legitimate";
  const status = requestedStatus === "closed" ? "closed" : requestedStatus;

  if (status === "closed") {
    return {
      status: "closed",
      isVerified: isLegitimate,
      moderationStatus: isLegitimate ? "none" : "force_closed",
      flagReasons: isLegitimate ? [] : ["fake_job_model"],
    };
  }

  if (!isLegitimate) {
    return {
      status: "pending_review",
      isVerified: false,
      moderationStatus: "flagged",
      flagReasons: ["fake_job_model"],
    };
  }

  if (status === "draft") {
    return {
      status: "draft",
      isVerified: true,
      moderationStatus: "none",
      flagReasons: [],
    };
  }

  return {
    status: "active",
    isVerified: true,
    moderationStatus: "none",
    flagReasons: [],
  };
};

export const runJobRiskGate = async (jobLike, requestedStatus) => {
  const risk = await classifyJobPostText(buildJobRiskText(jobLike));
  const decision = applyRiskDecision(requestedStatus, risk);
  return { risk, decision };
};

export const createJobStatusMessage = (status) => {
  if (status === "pending_review") {
    return "Job held for admin review — it is not visible to job seekers yet.";
  }
  if (status === "draft") {
    return "Job saved as draft";
  }
  if (status === "closed") {
    return "Job saved as closed";
  }
  return "Job created successfully";
};

export const updateJobStatusMessage = (status) => {
  if (status === "pending_review") {
    return "Job held for admin review — it is not visible to job seekers yet.";
  }
  if (status === "draft") {
    return "Job saved as draft";
  }
  if (status === "closed") {
    return "Job saved as closed";
  }
  return "Job updated successfully";
};
