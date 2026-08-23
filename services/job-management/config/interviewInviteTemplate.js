const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

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
    return new Date(startsAt).toISOString();
  }
};

const formatInterviewType = (type) => {
  const raw = String(type || "").trim().toLowerCase();
  if (raw === "video") return "Video interview";
  if (raw === "phone") return "Phone interview";
  if (raw === "onsite" || raw === "on-site" || raw === "in_person") {
    return "On-site interview";
  }
  if (!raw) return "Interview";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
};

const firstName = (fullName) => {
  const trimmed = String(fullName || "").trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0] || "there";
};

export const buildInterviewInviteSubject = (jobTitle, companyName) => {
  const title = String(jobTitle || "your interview").trim() || "your interview";
  const company = String(companyName || "").trim();
  return company
    ? `Interview invitation: ${title} at ${company}`
    : `Interview invitation: ${title}`;
};

/**
 * Branded HTML invite (aligned with application thank-you email styling).
 */
export const buildInterviewInviteHtml = ({
  candidateName,
  jobTitle,
  companyName,
  startsAt,
  timezone,
  type,
  conferenceUrl,
  location,
  notes,
  companyWebsite,
}) => {
  const safeName = escapeHtml(firstName(candidateName));
  const safeTitle = escapeHtml(jobTitle || "the role");
  const safeCompany = escapeHtml(companyName || "our company");
  const when = escapeHtml(formatWhen(startsAt, timezone));
  const tz = escapeHtml(timezone || "UTC");
  const typeLabel = escapeHtml(formatInterviewType(type));
  const joinUrl = String(conferenceUrl || "").trim();
  const safeJoin = joinUrl ? escapeHtml(joinUrl) : "";
  const safeLocation = location ? escapeHtml(String(location).trim()) : "";
  const safeNotes = notes ? escapeHtml(String(notes).trim()) : "";
  const website = String(companyWebsite || "").trim();
  const safeWebsite = website ? escapeHtml(website) : "";
  const websiteHref = website
    ? website.startsWith("http")
      ? website
      : `https://${website}`
    : "";

  const detailRows = [
    `<tr>
      <td style="padding: 10px 0 4px; font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: #858BBD;">When</td>
    </tr>
    <tr>
      <td style="padding: 0 0 12px; font-size: 15px; line-height: 1.5; color: #202871;">${when} <span style="color:#858BBD;">(${tz})</span></td>
    </tr>`,
    `<tr>
      <td style="padding: 10px 0 4px; font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: #858BBD;">Type</td>
    </tr>
    <tr>
      <td style="padding: 0 0 12px; font-size: 15px; line-height: 1.5; color: #202871;">${typeLabel}</td>
    </tr>`,
  ];

  if (safeLocation) {
    detailRows.push(`<tr>
      <td style="padding: 10px 0 4px; font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: #858BBD;">Location</td>
    </tr>
    <tr>
      <td style="padding: 0 0 12px; font-size: 15px; line-height: 1.5; color: #202871;">${safeLocation}</td>
    </tr>`);
  }

  if (safeNotes) {
    detailRows.push(`<tr>
      <td style="padding: 10px 0 4px; font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: #858BBD;">Notes</td>
    </tr>
    <tr>
      <td style="padding: 0 0 12px; font-size: 15px; line-height: 1.5; color: #333333;">${safeNotes}</td>
    </tr>`);
  }

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

  const websiteLine = safeWebsite
    ? `<p style="margin: 16px 0 0; font-size: 14px; line-height: 150%; color: #4C83EE;">
         Web: <a href="${escapeHtml(websiteHref)}" style="color:#4C83EE;text-decoration:none;">${safeWebsite}</a>
       </p>`
    : "";

  return `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Interview invitation</title>
</head>
<body style="margin:0;padding:0;font-family:'Open Sans',Arial,sans-serif;background:#F6FAFB;">
  <table width="100%" cellspacing="0" cellpadding="0" border="0" align="center" bgcolor="#F6FAFB">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table width="100%" style="max-width:560px;background:#ffffff;border-radius:8px;" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td style="background:#202871;border-radius:8px 8px 0 0;padding:20px 28px;">
              <p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#A8B4E8;">FraudAware Hiring</p>
              <p style="margin:8px 0 0;font-size:20px;font-weight:700;color:#ffffff;line-height:1.3;">Interview invitation</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 28px; color: #202871;">
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6;">Hi ${safeName},</p>
              <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.7; color: #333333;">
                You are invited to an interview for <strong>${safeTitle}</strong> at <strong>${safeCompany}</strong>.
                Please review the details below and join on time.
              </p>
              <table width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#F7F8FE;border-radius:8px;padding:4px 16px 8px;">
                <tr>
                  <td style="padding: 16px;">
                    <table width="100%" cellspacing="0" cellpadding="0" border="0">
                      ${detailRows.join("")}
                    </table>
                  </td>
                </tr>
              </table>
              ${joinBlock}
              <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #5B6473;">
                A calendar invitation has also been sent to this email if your recruiter has a mailbox connected.
              </p>
              <p style="margin: 24px 0 0; font-size: 15px; line-height: 1.6; color: #202871;">
                Best regards,<br>
                <strong>${safeCompany} Hiring Team</strong>
              </p>
              ${websiteLine}
              <p style="margin: 28px 0 0; font-size: 12px; line-height: 1.5; color: #858BBD;">
                Sent via FraudAware
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
