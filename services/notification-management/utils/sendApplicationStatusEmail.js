import transporter from "../config/nodemailer.js";
import {
  buildHiredEmailHtml,
  buildHiredEmailSubject,
  buildOfferedEmailHtml,
  buildOfferedEmailSubject,
} from "../config/applicationStatusEmailTemplate.js";
import ApplicationStatusEmailLog from "../model/applicationStatusEmailLogModel.js";

const extractFirstName = (fullName) => {
  const trimmed = String(fullName || "").trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0] || "there";
};

const STATUS_EMAIL = {
  offered: {
    kind: "offered",
    subject: buildOfferedEmailSubject,
    html: buildOfferedEmailHtml,
  },
  hired: {
    kind: "hired",
    subject: buildHiredEmailSubject,
    html: buildHiredEmailHtml,
  },
};

/**
 * Send branded email when application reaches offered or hired.
 */
export const sendApplicationStatusEmail = async ({
  applicationId,
  status,
  applicantEmail,
  applicantName,
  jobTitle,
  companyName,
  companyWebsite,
  hrEmail,
  sourceEventId,
}) => {
  const config = STATUS_EMAIL[String(status || "").trim()];
  if (!config) {
    return { skipped: true, reason: "status-not-emailed" };
  }

  if (!applicationId || !applicantEmail) {
    return { skipped: true, reason: "missing-recipient" };
  }

  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    return { skipped: true, reason: "smtp-not-configured" };
  }

  const existing = await ApplicationStatusEmailLog.findOne({
    applicationId: String(applicationId),
    kind: config.kind,
  }).select("_id");

  if (existing) {
    return { skipped: true, reason: "already-sent" };
  }

  const firstName = extractFirstName(applicantName);
  const subject = config.subject(companyName, jobTitle);
  const html = config.html({
    firstName,
    jobTitle,
    companyName,
    companyWebsite,
  });

  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
  const displayCompany = String(companyName || "Hiring Team").trim() || "Hiring Team";
  const replyTo = String(hrEmail || "").trim();

  await transporter.sendMail({
    from: `"${displayCompany} via FraudAware" <${fromEmail}>`,
    replyTo: replyTo || undefined,
    to: String(applicantEmail).trim(),
    subject,
    html,
  });

  try {
    await ApplicationStatusEmailLog.create({
      applicationId: String(applicationId),
      kind: config.kind,
      applicantEmail: String(applicantEmail).trim(),
      jobTitle: jobTitle || "",
      companyName: companyName || "",
      sourceEventId: sourceEventId || null,
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    return { skipped: true, reason: "already-sent" };
  }

  return { sent: true, kind: config.kind };
};
