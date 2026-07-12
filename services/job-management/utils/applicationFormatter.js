import { buildLogoFallback } from "./jobFormatter.js";
import { buildResumeDownloadUrl } from "./resumeUrlHelper.js";

const toIsoString = (value) => {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
};

/**
 * Shape application for frontend ApplicationListItem-style responses.
 */
export const formatApplication = (application, job = null) => {
  const companyName = job?.companyName || "";
  const companyLogo = job?.companyLogo || null;

  const resumeUrl = application.resumeUrl || undefined;
  const resumeName = application.resumeName || undefined;

  return {
    id: String(application._id),
    jobId: String(application.jobId),
    jobTitle: job?.title || "",
    companyName,
    status: application.status,
    logo: companyLogo || undefined,
    companyLogoUri: companyLogo || undefined,
    companyFallback: companyLogo ? undefined : buildLogoFallback(companyName),
    fullName: application.fullName,
    email: application.email,
    resumeUrl,
    resumeName,
    resumeDownloadUrl: buildResumeDownloadUrl(resumeUrl, resumeName),
    motivation: application.motivation || undefined,
    appliedAt: toIsoString(application.appliedAt) || new Date().toISOString(),
  };
};

export const formatApplicationList = (applications, jobsById = {}) =>
  applications.map((application) => {
    const job = jobsById[String(application.jobId)] || null;
    return formatApplication(application, job);
  });
