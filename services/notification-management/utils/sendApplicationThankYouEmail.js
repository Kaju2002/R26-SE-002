import transporter from "../config/nodemailer.js";
import { BRAND_NAME } from "../config/brand.js";
import {
  buildApplicationThankYouHtml,
  buildApplicationThankYouSubject,
} from "../config/applicationThankYouTemplate.js";
import ApplicationEmailLog from "../model/applicationEmailLogModel.js";

const extractFirstName = (fullName) => {
  const trimmed = String(fullName || "").trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0] || "there";
};

export const sendApplicationThankYouEmail = async ({
  applicationId,
  applicantEmail,
  applicantName,
  jobTitle,
  companyName,
  companyWebsite,
  hrEmail,
  sourceEventId,
}) => {
  if (!applicationId || !applicantEmail) {
    return { skipped: true, reason: "missing-recipient" };
  }

  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    return { skipped: true, reason: "smtp-not-configured" };
  }

  const existing = await ApplicationEmailLog.findOne({
    applicationId: String(applicationId),
  }).select("_id");

  if (existing) {
    return { skipped: true, reason: "already-sent" };
  }

  const firstName = extractFirstName(applicantName);
  const subject = buildApplicationThankYouSubject(companyName, jobTitle);
  const html = buildApplicationThankYouHtml({
    firstName,
    jobTitle,
    companyName,
    companyWebsite,
  });

  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
  const displayCompany = String(companyName || "Hiring Team").trim() || "Hiring Team";
  const replyTo = String(hrEmail || "").trim();

  await transporter.sendMail({
    from: `"${displayCompany} via ${BRAND_NAME}" <${fromEmail}>`,
    replyTo: replyTo || undefined,
    to: String(applicantEmail).trim(),
    subject,
    html,
  });

  try {
    await ApplicationEmailLog.create({
      applicationId: String(applicationId),
      applicantEmail: String(applicantEmail).trim(),
      jobTitle: jobTitle || "",
      companyName: companyName || "",
      sourceEventId: sourceEventId || null,
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    return { skipped: true, reason: "already-sent" };
  }

  return { sent: true };
};
