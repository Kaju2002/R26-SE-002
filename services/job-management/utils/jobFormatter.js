import { formatRiskSummaryLine } from "./jobRiskGate.js";

const FALLBACK_PALETTE = [
  { bg: "#FBE0B6", color: "#7A5418" },
  { bg: "#1F2A6E", color: "#FFFFFF" },
  { bg: "#FFE091", color: "#5C3F00" },
  { bg: "#D8E1FF", color: "#202871" },
];

export const buildLogoFallback = (name) => {
  if (!name?.trim()) return undefined;

  const words = name.trim().split(/\s+/).filter(Boolean);
  const text =
    words.length >= 2
      ? `${words[0][0]}${words[1][0]}`.toUpperCase()
      : name.slice(0, 2).toUpperCase();

  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const palette = FALLBACK_PALETTE[Math.abs(hash) % FALLBACK_PALETTE.length];

  return { text, bg: palette.bg, color: palette.color };
};

const toIsoString = (value) => {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
};

const formatSalaryCurrency = (currency) => {
  if (!currency || currency === "GHS") return "GH¢";
  return currency;
};

const formatSalaryPeriod = (period) => {
  if (!period || period === "month" || period === "monthly" || period === "per month") {
    return "/mo";
  }
  return period;
};

const formatContact = (contact) => {
  if (!contact) return undefined;

  const formatted = {
    location: contact.location || undefined,
    email: contact.email || undefined,
    phone: contact.phone || undefined,
    website: contact.website || undefined,
  };

  const hasValue = Object.values(formatted).some(Boolean);
  return hasValue ? formatted : undefined;
};

/**
 * Shape MongoDB job document to match frontend Job type (FraudAware/data/jobs.ts).
 */
export const formatJob = (job, extras = {}) => {
  if (!job) return null;

  const companyName = job.companyName || "";
  const companyLogo = job.companyLogo || null;

  return {
    id: String(job._id),
    workspaceId: job.workspaceId ? String(job.workspaceId) : null,
    title: job.title,
    companyName,
    companyLogoUri: companyLogo || undefined,
    companyFallback: companyLogo ? undefined : buildLogoFallback(companyName),
    isVerified: Boolean(job.isVerified),
    location: job.location,
    postedAt: toIsoString(job.postedAt) || new Date().toISOString(),
    endsAt: toIsoString(job.endsAt),
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    salaryCurrency: formatSalaryCurrency(job.salaryCurrency),
    salaryPeriod: formatSalaryPeriod(job.salaryPeriod),
    type: job.type,
    mode: job.mode,
    applicants: job.applicantsCount ?? 0,
    description: job.description?.length ? job.description : undefined,
    requirements: job.requirements?.length ? job.requirements : undefined,
    benefits: job.benefits?.length ? job.benefits : undefined,
    skills: job.skills?.length ? job.skills : undefined,
    perks: job.perks?.length ? job.perks : undefined,
    jobLevel: job.jobLevel || undefined,
    education: job.education || undefined,
    experience: job.experience || undefined,
    about: job.about || undefined,
    contact: formatContact(job.contact),
    status: job.status,
    postedBy: job.postedBy,
    posterType: job.posterType || "recruiter",
    posterImage: job.posterImage || undefined,
    posterName: job.posterName || undefined,
    posterEmail: job.posterEmail || undefined,
    moderationStatus: job.moderationStatus || "none",
    riskCheck: job.riskCheck
      ? {
          prediction: job.riskCheck.prediction || undefined,
          fakeProbability: job.riskCheck.fakeProbability ?? undefined,
          legitimateProbability: job.riskCheck.legitimateProbability ?? undefined,
          confidence: job.riskCheck.confidence ?? undefined,
          message: job.riskCheck.message || undefined,
          checkedAt: toIsoString(job.riskCheck.checkedAt),
          text: job.riskCheck.text
            ? {
                prediction: job.riskCheck.text.prediction || undefined,
                fakeProbability: job.riskCheck.text.fakeProbability ?? undefined,
                message: job.riskCheck.text.message || undefined,
                lime: job.riskCheck.text.lime || [],
                shap: job.riskCheck.text.shap || [],
              }
            : undefined,
          image: job.riskCheck.image
            ? {
                prediction: job.riskCheck.image.prediction || undefined,
                fakeProbability: job.riskCheck.image.fakeProbability ?? undefined,
                message: job.riskCheck.image.message || undefined,
                lime: job.riskCheck.image.lime || [],
                shap: job.riskCheck.image.shap || [],
              }
            : undefined,
        }
      : undefined,
    ...extras,
  };
};

const formatSalaryLabel = (job) => {
  if (job.salaryMin == null && job.salaryMax == null) return "—";
  const currency = formatSalaryCurrency(job.salaryCurrency);
  return `${currency} ${job.salaryMin ?? 0} – ${job.salaryMax ?? 0}`.trim();
};

export const formatModeratedJob = (job) => {
  if (!job) return null;
  const listingStatus =
    job.status === "pending_review" || job.status === "draft"
      ? job.status
      : job.status === "closed"
        ? "closed"
        : "active";

  return {
    id: String(job._id),
    title: job.title,
    companyName: job.companyName,
    posterType: job.posterType || "recruiter",
    posterName: job.posterName || "",
    posterEmail: job.posterEmail || "",
    posterImage: job.posterImage || undefined,
    location: job.location,
    mode: job.mode,
    type: job.type,
    salaryLabel: formatSalaryLabel(job),
    description: Array.isArray(job.description)
      ? job.description.join("\n")
      : String(job.description || ""),
    listingStatus,
    moderationStatus:
      job.moderationStatus === "none" ? "cleared" : job.moderationStatus,
    fakeJobScore: job.riskCheck?.fakeProbability ?? 0,
    textFakeProbability: job.riskCheck?.text?.fakeProbability ?? null,
    imageFakeProbability: job.riskCheck?.image?.fakeProbability ?? null,
    riskSummary: formatRiskSummaryLine(
      job,
      job.riskCheck?.text,
      job.riskCheck?.image,
      job.riskCheck
    ),
    flagReasons: Array.isArray(job.flagReasons) && job.flagReasons.length
      ? job.flagReasons
      : job.moderationStatus === "flagged"
        ? ["fake_job_model"]
        : [],
    reportCount: Number(job.reportCount) || 0,
    applicants: job.applicantsCount ?? 0,
    postedAt: toIsoString(job.postedAt) || new Date().toISOString(),
    flaggedAt: toIsoString(job.flaggedAt || job.riskCheck?.checkedAt) || new Date().toISOString(),
    reviewedAt: toIsoString(job.moderatedAt) || null,
    closeReason: job.closeReason || null,
    riskMessage: job.riskCheck?.message || "",
    riskPrediction: job.riskCheck?.prediction || "",
    textPrediction: job.riskCheck?.text?.prediction || "",
    imagePrediction: job.riskCheck?.image?.prediction || "",
    textLime: job.riskCheck?.text?.lime || [],
    textShap: job.riskCheck?.text?.shap || [],
    imageLime: job.riskCheck?.image?.lime || [],
    imageShap: job.riskCheck?.image?.shap || [],
  };
};

export const formatJobList = (jobs, extrasById = {}) =>
  jobs.map((job) => formatJob(job, extrasById[String(job._id)] || {}));
