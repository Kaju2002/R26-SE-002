import { classifyJobPostText, classifyJobPosterImage } from "./fakeJobDetectionClient.js";

const asLines = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean).join("\n");
  }
  return String(value || "").trim();
};

const labeled = (label, value) => {
  const text = asLines(value);
  return text ? `${label}: ${text}` : "";
};

const labeledBlock = (label, value) => {
  const text = asLines(value);
  return text ? `${label}:\n${text}` : "";
};

const formatSalary = (job) => {
  const min = Number.isFinite(Number(job.salaryMin)) ? Number(job.salaryMin) : null;
  const max = Number.isFinite(Number(job.salaryMax)) ? Number(job.salaryMax) : null;
  if (min == null && max == null) return "";

  const currency = String(job.salaryCurrency || "").trim();
  const period = String(job.salaryPeriod || "").trim();
  const range =
    min != null && max != null ? `${min}-${max}` : String(min ?? max);
  return `Salary: ${[range, currency, period].filter(Boolean).join(" ")}`;
};

const formatContact = (contact) => {
  if (!contact || typeof contact !== "object") return "";
  const parts = [contact.email, contact.phone, contact.website, contact.location]
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  return parts.length ? `Contact: ${parts.join(" | ")}` : "";
};

const formatClosingDate = (endsAt) => {
  if (!endsAt) return "";
  const date = new Date(endsAt);
  if (Number.isNaN(date.getTime())) return "";
  return `Closing date: ${date.toISOString().slice(0, 10)}`;
};

export const buildJobRiskText = (job = {}) =>
  [
    labeled("Title", job.title),
    labeled("Company", job.companyName),
    labeled("Location", job.location),
    labeled("Type", job.type),
    labeled("Mode", job.mode),
    formatSalary(job),
    labeled("Job level", job.jobLevel),
    labeled("Education", job.education),
    labeled("Experience", job.experience),
    labeledBlock("Description", job.description),
    labeledBlock("Requirements", job.requirements),
    Array.isArray(job.skills) && job.skills.length
      ? labeled("Skills", job.skills.join(", "))
      : labeled("Skills", job.skills),
    labeledBlock("Benefits", job.benefits),
    labeledBlock("Perks", job.perks),
    labeledBlock("About", job.about),
    formatContact(job.contact),
    formatClosingDate(job.endsAt),
  ]
    .filter(Boolean)
    .join("\n\n");

const PREDICTION_RANK = {
  skipped: -1,
  legitimate: 0,
  error: 1,
  suspicious: 2,
  fake: 3,
};

const isBlockingPrediction = (prediction) => {
  const value = String(prediction || "error").toLowerCase();
  return value === "fake" || value === "suspicious" || value === "error";
};

const pickWorsePrediction = (left, right) => {
  const a = String(left || "error").toLowerCase();
  const b = String(right || "error").toLowerCase();
  return (PREDICTION_RANK[a] || 0) >= (PREDICTION_RANK[b] || 0) ? a : b;
};

const maxProb = (...values) => {
  const numbers = values.filter((value) => typeof value === "number");
  return numbers.length ? Math.max(...numbers) : null;
};

export const combineRiskResults = (textRisk, imageRisk) => {
  const text = textRisk || {};
  const image = imageRisk || {};
  const textBlocks = isBlockingPrediction(text.prediction);
  const imageSkipped = String(image.prediction || "").toLowerCase() === "skipped";
  const imageBlocks = !imageSkipped && isBlockingPrediction(image.prediction);

  const flagReasons = [];
  if (textBlocks) flagReasons.push("fake_job_model");
  if (imageBlocks) flagReasons.push("fake_job_poster");

  const prediction = textBlocks || imageBlocks
    ? pickWorsePrediction(
        textBlocks ? text.prediction : "legitimate",
        imageBlocks ? image.prediction : "legitimate"
      )
    : "legitimate";

  const imageLabel = imageSkipped
    ? `Poster: skipped (${image.message || "no poster"})`
    : `Poster: ${image.prediction || "unknown"}${
        image.message ? ` — ${image.message}` : ""
      }`;
  const textLabel = `Text: ${text.prediction || "unknown"}${
    text.message ? ` — ${text.message}` : ""
  }`;

  let message = `${textLabel}. ${imageLabel}.`;
  if (textBlocks && imageBlocks) {
    message += " Held because both the listing text and the poster were flagged.";
  } else if (textBlocks) {
    message += " Held because the listing text was flagged.";
  } else if (imageBlocks) {
    message += " Held because the job poster was flagged.";
  }

  return {
    prediction,
    fakeProbability: maxProb(text.fakeProbability, image.fakeProbability),
    legitimateProbability:
      prediction === "legitimate"
        ? maxProb(text.legitimateProbability, image.legitimateProbability)
        : null,
    confidence: maxProb(text.confidence, image.confidence),
    message,
    checkedAt: new Date(),
    flagReasons,
    text: {
      prediction: text.prediction || "error",
      fakeProbability: text.fakeProbability ?? null,
      legitimateProbability: text.legitimateProbability ?? null,
      confidence: text.confidence ?? null,
      message: text.message || "",
    },
    image: {
      prediction: image.prediction || "error",
      fakeProbability: image.fakeProbability ?? null,
      legitimateProbability: image.legitimateProbability ?? null,
      confidence: image.confidence ?? null,
      message: image.message || "",
      extractedText: image.extractedText || "",
    },
  };
};

export const applyRiskDecision = (requestedStatus, risk) => {
  const prediction = String(risk?.prediction || "error").toLowerCase();
  const isLegitimate = prediction === "legitimate";
  const status = requestedStatus === "closed" ? "closed" : requestedStatus;
  const flagReasons = isLegitimate
    ? []
    : Array.isArray(risk?.flagReasons) && risk.flagReasons.length
      ? risk.flagReasons
      : ["fake_job_model"];

  if (status === "closed") {
    return {
      status: "closed",
      isVerified: isLegitimate,
      moderationStatus: isLegitimate ? "none" : "force_closed",
      flagReasons: isLegitimate ? [] : flagReasons,
    };
  }

  if (!isLegitimate) {
    return {
      status: "pending_review",
      isVerified: false,
      moderationStatus: "flagged",
      flagReasons,
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

export const formatPercent = (value) =>
  typeof value === "number" && Number.isFinite(value)
    ? `${Math.round(value * 100)}%`
    : "n/a";

export const formatRiskSummaryLine = (jobLike, textRisk, imageRisk, combined) => {
  const title = String(jobLike?.title || "untitled").trim() || "untitled";
  return `[fake-job] "${title}" text=${formatPercent(textRisk?.fakeProbability)} fake (${textRisk?.prediction || "unknown"}) | poster=${formatPercent(imageRisk?.fakeProbability)} fake (${imageRisk?.prediction || "unknown"}) | combined=${combined?.prediction || "unknown"}`;
};

const logRiskPercents = (jobLike, textRisk, imageRisk, combined) => {
  console.log(formatRiskSummaryLine(jobLike, textRisk, imageRisk, combined));
};

export const runJobRiskGate = async (jobLike, requestedStatus, options = {}) => {
  const [textRisk, imageRisk] = await Promise.all([
    classifyJobPostText(buildJobRiskText(jobLike)),
    classifyJobPosterImage({
      file: options.posterFile || null,
      url: options.posterUrl || jobLike?.posterImage || null,
    }),
  ]);
  const risk = combineRiskResults(textRisk, imageRisk);
  logRiskPercents(jobLike, textRisk, imageRisk, risk);
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
