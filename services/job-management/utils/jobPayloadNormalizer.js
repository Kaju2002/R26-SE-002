import { JOB_MODES, JOB_TYPES, JOB_STATUSES } from "../model/jobModel.js";

export const MIN_DESCRIPTION_LENGTH = 15;

const parseNumber = (value) => {
  if (value === undefined || value === null || value === "") return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
};

const parseMultilineList = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value !== "string" || !value.trim()) return [];
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
};

const parseSkillsList = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value !== "string" || !value.trim()) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const normalizeSalaryPeriod = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (!normalized || normalized === "month" || normalized === "monthly" || normalized === "per month") {
    return "/mo";
  }
  return String(value).trim();
};

const normalizeCurrency = (value) => {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();
  if (!normalized || normalized === "GHS" || normalized === "GH¢") return "GHS";
  return String(value).trim();
};

const normalizeContact = (body, jobLocation) => {
  const nested =
    body.contact && typeof body.contact === "object" ? body.contact : {};

  const contact = {
    location: nested.location?.trim() || jobLocation?.trim() || "",
    email: nested.email?.trim() || body.email?.trim() || "",
    phone: nested.phone?.trim() || body.phone?.trim() || "",
    website: nested.website?.trim() || body.website?.trim() || "",
  };

  const hasValue = Object.values(contact).some(Boolean);
  return hasValue ? contact : {};
};

const parseClosingDate = (body) => {
  const raw = body.closingDate || body.endsAt;
  if (!raw) return null;

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return { error: "Closing date is invalid" };
  return { value: date };
};

const parseSalaryPair = (body) => {
  const minStr =
    body.salaryMin === undefined || body.salaryMin === null
      ? ""
      : String(body.salaryMin).trim();
  const maxStr =
    body.salaryMax === undefined || body.salaryMax === null
      ? ""
      : String(body.salaryMax).trim();

  if (minStr === "" && maxStr === "") {
    return { salaryMin: 0, salaryMax: 0 };
  }

  if (minStr === "" || maxStr === "") {
    return { error: "Enter both minimum and maximum salary, or leave both empty." };
  }

  const salaryMin = parseNumber(minStr);
  const salaryMax = parseNumber(maxStr);

  if (salaryMin === undefined || salaryMax === undefined || salaryMin < 0 || salaryMax < 0) {
    return { error: "Salary must be valid numbers." };
  }

  if (salaryMin > salaryMax) {
    return { error: "Minimum salary cannot be greater than maximum." };
  }

  return { salaryMin, salaryMax };
};

/**
 * Normalize create-job input from PostJobForm (JSON or multipart fields).
 */
export const normalizeJobCreateInput = (
  body,
  uploadedLogoUrl = null,
  uploadedPosterUrl = null
) => {
  const data = body && typeof body === "object" ? body : {};
  const errors = [];
  const type = data.type || data.jobType;
  const mode = data.mode || data.jobMode;
  const title = data.title?.trim() || "";
  const companyName = data.companyName?.trim() || "";
  const location = data.location?.trim() || "";
  const descriptionText = String(data.description || "").trim();

  if (!title) errors.push("Job title is required");
  if (!companyName) errors.push("Company name is required");
  if (!location) errors.push("Location is required");
  if (!mode || !JOB_MODES.includes(mode)) {
    errors.push(`Work mode must be one of: ${JOB_MODES.join(", ")}`);
  }
  if (!type || !JOB_TYPES.includes(type)) {
    errors.push(`Job type must be one of: ${JOB_TYPES.join(", ")}`);
  }
  if (descriptionText.length < MIN_DESCRIPTION_LENGTH) {
    errors.push(`Add at least ${MIN_DESCRIPTION_LENGTH} characters describing the role.`);
  }

  const salary = parseSalaryPair(data);
  if (salary.error) errors.push(salary.error);

  const closingDate = parseClosingDate(data);
  if (closingDate?.error) errors.push(closingDate.error);

  const requestedStatus =
    typeof data.status === "string" ? data.status.trim() : data.status;
  const status =
    requestedStatus && JOB_STATUSES.includes(requestedStatus) ? requestedStatus : "draft";

  if (errors.length) {
    return { errors };
  }

  const benefitsSource = data.benefitsLines ?? data.benefits;
  const perksSource = data.perksLines ?? data.perks;
  const companyLogo =
    uploadedLogoUrl || data.companyLogo?.trim() || data.logoUri?.trim() || null;
  const posterImage =
    uploadedPosterUrl ||
    (typeof data.posterImage === "string" ? data.posterImage.trim() : "") ||
    null;

  return {
    errors: [],
    status,
    document: {
      title,
      companyName,
      companyLogo,
      posterImage,
      location,
      mode,
      type,
      salaryMin: salary.salaryMin,
      salaryMax: salary.salaryMax,
      salaryCurrency: normalizeCurrency(data.currency ?? data.salaryCurrency),
      salaryPeriod: normalizeSalaryPeriod(data.salaryPeriod),
      description: parseMultilineList(descriptionText),
      requirements: parseMultilineList(data.requirements),
      benefits: parseMultilineList(benefitsSource),
      skills: parseSkillsList(data.skills),
      perks: parseMultilineList(perksSource),
      jobLevel: data.jobLevel?.trim() || "",
      education: data.education?.trim() || "",
      experience: data.experience?.trim() || "",
      about: data.about?.trim() || "",
      contact: normalizeContact(data, location),
      endsAt: closingDate?.value || null,
      status: status === "closed" ? "draft" : status,
    },
  };
};

const hasField = (data, key) =>
  Object.prototype.hasOwnProperty.call(data, key) && data[key] !== undefined;

/**
 * Normalize partial update input for job owner edits.
 */
export const normalizeJobUpdateInput = (
  body,
  uploadedLogoUrl = null,
  existingJob,
  uploadedPosterUrl = null
) => {
  const data = body && typeof body === "object" ? body : {};
  const errors = [];
  const patch = {};

  if (hasField(data, "title")) {
    const title = data.title?.trim() || "";
    if (!title) errors.push("Job title cannot be empty");
    else patch.title = title;
  }

  if (hasField(data, "companyName")) {
    const companyName = data.companyName?.trim() || "";
    if (!companyName) errors.push("Company name cannot be empty");
    else patch.companyName = companyName;
  }

  if (hasField(data, "location")) {
    const location = data.location?.trim() || "";
    if (!location) errors.push("Location cannot be empty");
    else patch.location = location;
  }

  const mode = hasField(data, "mode") ? data.mode : hasField(data, "jobMode") ? data.jobMode : undefined;
  if (mode !== undefined) {
    if (!JOB_MODES.includes(mode)) {
      errors.push(`Work mode must be one of: ${JOB_MODES.join(", ")}`);
    } else {
      patch.mode = mode;
    }
  }

  const type = hasField(data, "type") ? data.type : hasField(data, "jobType") ? data.jobType : undefined;
  if (type !== undefined) {
    if (!JOB_TYPES.includes(type)) {
      errors.push(`Job type must be one of: ${JOB_TYPES.join(", ")}`);
    } else {
      patch.type = type;
    }
  }

  if (hasField(data, "description")) {
    const descriptionText = String(data.description || "").trim();
    if (descriptionText.length < MIN_DESCRIPTION_LENGTH) {
      errors.push(`Add at least ${MIN_DESCRIPTION_LENGTH} characters describing the role.`);
    } else {
      patch.description = parseMultilineList(descriptionText);
    }
  }

  const hasSalaryMin = hasField(data, "salaryMin");
  const hasSalaryMax = hasField(data, "salaryMax");
  if (hasSalaryMin || hasSalaryMax) {
    const salary = parseSalaryPair({
      salaryMin: hasSalaryMin ? data.salaryMin : existingJob.salaryMin,
      salaryMax: hasSalaryMax ? data.salaryMax : existingJob.salaryMax,
    });
    if (salary.error) errors.push(salary.error);
    else {
      patch.salaryMin = salary.salaryMin;
      patch.salaryMax = salary.salaryMax;
    }
  }

  if (hasField(data, "currency") || hasField(data, "salaryCurrency")) {
    patch.salaryCurrency = normalizeCurrency(data.currency ?? data.salaryCurrency);
  }

  if (hasField(data, "salaryPeriod")) {
    patch.salaryPeriod = normalizeSalaryPeriod(data.salaryPeriod);
  }

  if (hasField(data, "requirements")) {
    patch.requirements = parseMultilineList(data.requirements);
  }

  if (hasField(data, "benefitsLines") || hasField(data, "benefits")) {
    patch.benefits = parseMultilineList(data.benefitsLines ?? data.benefits);
  }

  if (hasField(data, "skills")) {
    patch.skills = parseSkillsList(data.skills);
  }

  if (hasField(data, "perksLines") || hasField(data, "perks")) {
    patch.perks = parseMultilineList(data.perksLines ?? data.perks);
  }

  if (hasField(data, "jobLevel")) patch.jobLevel = data.jobLevel?.trim() || "";
  if (hasField(data, "education")) patch.education = data.education?.trim() || "";
  if (hasField(data, "experience")) patch.experience = data.experience?.trim() || "";
  if (hasField(data, "about")) patch.about = data.about?.trim() || "";

  if (
    hasField(data, "contact") ||
    hasField(data, "email") ||
    hasField(data, "phone") ||
    hasField(data, "website")
  ) {
    const location = patch.location || existingJob.location;
    patch.contact = normalizeContact(data, location);
  }

  if (hasField(data, "closingDate") || hasField(data, "endsAt")) {
    const closingDate = parseClosingDate(data);
    if (closingDate?.error) errors.push(closingDate.error);
    else patch.endsAt = closingDate?.value || null;
  }

  if (hasField(data, "status")) {
    const requestedStatus =
      typeof data.status === "string" ? data.status.trim() : data.status;
    if (!JOB_STATUSES.includes(requestedStatus)) {
      errors.push(`Status must be one of: ${JOB_STATUSES.join(", ")}`);
    } else {
      patch.status = requestedStatus;
    }
  }

  if (uploadedLogoUrl) {
    patch.companyLogo = uploadedLogoUrl;
  } else if (hasField(data, "companyLogo") || hasField(data, "logoUri")) {
    patch.companyLogo = data.companyLogo?.trim() || data.logoUri?.trim() || null;
  }

  if (uploadedPosterUrl) {
    patch.posterImage = uploadedPosterUrl;
  } else if (hasField(data, "posterImage")) {
    const nextPoster =
      typeof data.posterImage === "string" ? data.posterImage.trim() : "";
    patch.posterImage = nextPoster || null;
  }

  if (errors.length) {
    return { errors };
  }

  if (Object.keys(patch).length === 0) {
    return {
      errors: ["No valid fields provided to update"],
    };
  }

  return {
    errors: [],
    patch,
  };
};
