import { BRAND_NAME } from "./brand.js";

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const websiteRow = (companyWebsite) => {
  const website = String(companyWebsite || "").trim();
  if (!website) return "";
  const safeWebsite = escapeHtml(website);
  const href = website.startsWith("http") ? website : `https://${website}`;
  return `<p style="margin: 16px 0 0; font-size: 14px; line-height: 150%; color: #4C83EE;">
    Web: <a href="${escapeHtml(href)}" style="color:#4C83EE;text-decoration:none;">${safeWebsite}</a>
  </p>`;
};

const shell = ({ title, headline, bodyHtml, companyName, companyWebsite }) => {
  const safeCompany = escapeHtml(companyName || "our company");
  return `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
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
              ${bodyHtml}
              <p style="margin: 24px 0 0; font-size: 15px; line-height: 1.6; color: #202871;">
                Best regards,<br>
                <strong>${safeCompany} Hiring Team</strong>
              </p>
              ${websiteRow(companyWebsite)}
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

export const buildOfferedEmailSubject = (companyName, jobTitle) => {
  const company = String(companyName || "the company").trim() || "the company";
  const title = String(jobTitle || "the role").trim() || "the role";
  return `Job offer: ${title} at ${company}`;
};

export const buildHiredEmailSubject = (companyName, jobTitle) => {
  const company = String(companyName || "the company").trim() || "the company";
  const title = String(jobTitle || "the role").trim() || "the role";
  return `Congratulations — you're hired | ${title} at ${company}`;
};

export const buildOfferedEmailHtml = ({
  firstName,
  jobTitle,
  companyName,
  companyWebsite,
}) => {
  const safeName = escapeHtml(firstName || "there");
  const safeTitle = escapeHtml(jobTitle || "the role");
  const safeCompany = escapeHtml(companyName || "our company");

  const bodyHtml = `
    <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6;">Hi ${safeName},</p>
    <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.7; color: #333333;">
      Great news — we are pleased to offer you the <strong>${safeTitle}</strong> position at <strong>${safeCompany}</strong>.
    </p>
    <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.7; color: #333333;">
      Our team will follow up with offer details and next steps shortly. If you have any questions in the meantime, reply to this email or message us on ${BRAND_NAME}.
    </p>
    <p style="margin: 0; font-size: 15px; line-height: 1.7; color: #333333;">
      Congratulations again — we look forward to the possibility of working together.
    </p>
  `;

  return shell({
    title: "Job offer",
    headline: "You've received an offer",
    bodyHtml,
    companyName,
    companyWebsite,
  });
};

export const buildHiredEmailHtml = ({
  firstName,
  jobTitle,
  companyName,
  companyWebsite,
}) => {
  const safeName = escapeHtml(firstName || "there");
  const safeTitle = escapeHtml(jobTitle || "the role");
  const safeCompany = escapeHtml(companyName || "our company");

  const bodyHtml = `
    <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6;">Hi ${safeName},</p>
    <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.7; color: #333333;">
      Congratulations! You have been <strong>selected and hired</strong> for the <strong>${safeTitle}</strong> role at <strong>${safeCompany}</strong>.
    </p>
    <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.7; color: #333333;">
      Welcome aboard — we are excited to have you join the team. Your recruiter or hiring manager will share onboarding details and start-date next steps soon.
    </p>
    <p style="margin: 0; font-size: 15px; line-height: 1.7; color: #333333;">
      If you need anything before then, reply to this email or reach out on ${BRAND_NAME}.
    </p>
  `;

  return shell({
    title: "You're hired",
    headline: "Welcome to the team",
    bodyHtml,
    companyName,
    companyWebsite,
  });
};
