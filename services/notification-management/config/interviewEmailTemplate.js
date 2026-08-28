import { BRAND_NAME } from "./brand.js";

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const firstName = (fullName) => {
  const trimmed = String(fullName || "").trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0] || "there";
};

const formatWhen = (startsAt, timezone) => {
  try {
    return new Date(startsAt).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: timezone || undefined,
    });
  } catch {
    return String(startsAt || "");
  }
};

export const buildInterviewReminderSubject = ({
  title,
  reminderKind,
  jobTitle,
}) => {
  if (title) return String(title);
  const role = String(jobTitle || "your interview").trim() || "your interview";
  return reminderKind === "1h"
    ? `Interview starting soon: ${role}`
    : `Interview reminder: ${role}`;
};

/** Same visual language as interview invite / application thank-you emails. */
export const buildInterviewReminderHtml = ({
  candidateName,
  jobTitle,
  companyName,
  startsAt,
  timezone,
  conferenceUrl,
  body,
  reminderKind,
}) => {
  const safeName = escapeHtml(firstName(candidateName));
  const safeTitle = escapeHtml(jobTitle || "your interview");
  const safeCompany = escapeHtml(companyName || "our company");
  const when = escapeHtml(formatWhen(startsAt, timezone));
  const tz = escapeHtml(timezone || "UTC");
  const headline =
    reminderKind === "1h" ? "Your interview starts soon" : "Interview reminder";
  const intro =
    body ||
    `This is a reminder for your interview for ${jobTitle || "the role"} at ${companyName || "the company"}.`;
  const safeIntro = escapeHtml(intro);
  const joinUrl = String(conferenceUrl || "").trim();
  const safeJoin = joinUrl ? escapeHtml(joinUrl) : "";

  const joinBlock = safeJoin
    ? `<table width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td style="padding: 20px 0 8px;" align="center">
            <a href="${safeJoin}"
               style="display:inline-block;background:#202871;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 28px;border-radius:10px;">
              Join interview
            </a>
            <p style="margin: 12px 0 0; font-size: 12px; line-height: 1.5; color: #858BBD; word-break: break-all;">
              Or open: <a href="${safeJoin}" style="color:#4C83EE;text-decoration:none;">${safeJoin}</a>
            </p>
          </td>
        </tr>
      </table>`
    : "";

  return `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(headline)}</title>
</head>
<body style="margin:0;padding:0;font-family:'Open Sans',Arial,sans-serif;background:#F6FAFB;">
  <table width="100%" cellspacing="0" cellpadding="0" border="0" align="center" bgcolor="#F6FAFB">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table width="100%" style="max-width:560px;background:#ffffff;border-radius:8px;" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td style="background:#202871;border-radius:8px 8px 0 0;padding:20px 28px;">
              <p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#A8B4E8;">${escapeHtml(BRAND_NAME)}</p>
              <p style="margin:8px 0 0;font-size:20px;font-weight:700;color:#ffffff;line-height:1.3;">${escapeHtml(headline)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 28px; color: #202871;">
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6;">Hi ${safeName},</p>
              <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.7; color: #333333;">${safeIntro}</p>
              <table width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#F7F8FE;border-radius:8px;">
                <tr>
                  <td style="padding: 16px;">
                    <p style="margin: 0 0 4px; font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: #858BBD;">Role</p>
                    <p style="margin: 0 0 12px; font-size: 15px; color: #202871;"><strong>${safeTitle}</strong> · ${safeCompany}</p>
                    <p style="margin: 0 0 4px; font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: #858BBD;">When</p>
                    <p style="margin: 0; font-size: 15px; color: #202871;">${when} <span style="color:#858BBD;">(${tz})</span></p>
                  </td>
                </tr>
              </table>
              ${joinBlock}
              <p style="margin: 24px 0 0; font-size: 15px; line-height: 1.6; color: #202871;">
                Best regards,<br>
                <strong>${safeCompany} Hiring Team</strong>
              </p>
              <p style="margin: 28px 0 0; font-size: 12px; line-height: 1.5; color: #858BBD;">
                Sent via ${escapeHtml(BRAND_NAME)}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};
