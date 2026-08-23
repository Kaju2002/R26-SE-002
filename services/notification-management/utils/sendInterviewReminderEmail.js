import transporter from "../config/nodemailer.js";
import {
  buildInterviewReminderHtml,
  buildInterviewReminderSubject,
} from "../config/interviewEmailTemplate.js";

export const sendInterviewReminderEmail = async ({
  candidateEmail,
  candidateName,
  jobTitle,
  companyName,
  startsAt,
  timezone,
  conferenceUrl,
  reminderKind,
  title,
  body,
}) => {
  if (!candidateEmail) {
    return { skipped: true, reason: "missing-recipient" };
  }
  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    return { skipped: true, reason: "smtp-not-configured" };
  }

  const subject = buildInterviewReminderSubject({
    title,
    reminderKind,
    jobTitle,
  });

  const html = buildInterviewReminderHtml({
    candidateName,
    jobTitle,
    companyName,
    startsAt,
    timezone,
    conferenceUrl,
    body,
    reminderKind,
  });

  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
  const displayCompany = String(companyName || "Hiring Team").trim() || "Hiring Team";

  await transporter.sendMail({
    from: `"${displayCompany}" <${fromEmail}>`,
    to: candidateEmail,
    subject,
    html,
    text: body || subject,
  });

  return { skipped: false, ok: true };
};
