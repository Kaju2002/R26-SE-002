import transporter from "../config/nodemailer.js";

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

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

  const when = (() => {
    try {
      return new Date(startsAt).toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: timezone || undefined,
      });
    } catch {
      return String(startsAt || "");
    }
  })();

  const joinHtml = conferenceUrl
    ? `<p><strong>Join video:</strong> <a href="${escapeHtml(conferenceUrl)}">${escapeHtml(conferenceUrl)}</a></p>`
    : "";

  const subject =
    title ||
    (reminderKind === "1h"
      ? `Interview starting soon: ${jobTitle || "your interview"}`
      : `Interview reminder: ${jobTitle || "your interview"}`);

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#202871">
      <p>Hi ${escapeHtml((candidateName || "").split(/\s+/)[0] || "there")},</p>
      <p>${escapeHtml(body || `Your interview for ${jobTitle} at ${companyName} is coming up.`)}</p>
      <p><strong>When:</strong> ${escapeHtml(when)} (${escapeHtml(timezone || "UTC")})</p>
      ${joinHtml}
      <p style="color:#858BBD;font-size:12px">— FraudAware Hiring</p>
    </div>
  `.trim();

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
