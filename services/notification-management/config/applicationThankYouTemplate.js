const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const buildApplicationThankYouSubject = (companyName, jobTitle) => {
  const company = String(companyName || "the company").trim() || "the company";
  const title = String(jobTitle || "the role").trim() || "the role";
  return `Thank you for applying to ${company} | ${title}`;
};

export const buildApplicationThankYouHtml = ({
  firstName,
  jobTitle,
  companyName,
  companyWebsite,
}) => {
  const safeName = escapeHtml(firstName || "there");
  const safeTitle = escapeHtml(jobTitle || "the position");
  const safeCompany = escapeHtml(companyName || "our team");
  const website = String(companyWebsite || "").trim();
  const safeWebsite = website ? escapeHtml(website) : "";
  const websiteLine = safeWebsite
    ? `<tr>
        <td style="padding: 16px 0 0; font-size: 14px; line-height: 150%; color: #4C83EE;">
          Web: <a href="${safeWebsite.startsWith("http") ? safeWebsite : `https://${safeWebsite}`}" style="color: #4C83EE; text-decoration: none;">${safeWebsite}</a>
        </td>
      </tr>`
    : "";

  return `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Application received</title>
</head>
<body style="margin:0;padding:0;font-family:'Open Sans',Arial,sans-serif;background:#F6FAFB;">
  <table width="100%" cellspacing="0" cellpadding="0" border="0" align="center" bgcolor="#F6FAFB">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table width="100%" style="max-width:560px;background:#ffffff;border-radius:8px;" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td style="padding: 32px 28px; color: #202871;">
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6;">Hi ${safeName},</p>
              <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.7; color: #333333;">
                Thank you for applying to the <strong>${safeTitle}</strong> position. We've successfully received your application and are currently reviewing all submissions.
              </p>
              <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.7; color: #333333;">
                If you are shortlisted, a recruiter will reach out to you through FraudAware. Regardless of the outcome, we will keep you updated on the status of your application.
              </p>
              <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.7; color: #333333;">
                We appreciate your interest in joining our team and thank you for considering us as your next career step.
              </p>
              <p style="margin: 0; font-size: 15px; line-height: 1.7; color: #333333;">
                Thank you once again for taking the time to apply.
              </p>
              <p style="margin: 24px 0 0; font-size: 15px; line-height: 1.6; color: #202871;">
                Best regards,<br>
                <strong>${safeCompany} Hiring Team</strong>
              </p>
              ${websiteLine}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};
