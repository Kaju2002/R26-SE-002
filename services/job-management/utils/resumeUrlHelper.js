const UPLOAD_MARKER = "/upload/";

/**
 * Normalize resume filename for Content-Disposition / Cloudinary fl_attachment.
 */
export const resolveResumeFilename = (resumeName, resumeUrl) => {
  let name = (resumeName || "").trim();

  if (!name && resumeUrl) {
    const fromUrl = resumeUrl.split("/").pop()?.split("?")[0];
    if (fromUrl) name = fromUrl;
  }

  if (!name) name = "resume.pdf";

  name = name.replace(/[/\\?%*:|"<>]/g, "_").replace(/\s+/g, "_");

  if (!/\.(pdf|doc|docx)$/i.test(name)) {
    name = `${name}.pdf`;
  }

  return name;
};

/**
 * Build a Cloudinary URL that downloads with the original resume filename.
 * @see https://cloudinary.com/documentation/image_delivery#forced_download
 */
export const buildResumeDownloadUrl = (resumeUrl, resumeName) => {
  if (!resumeUrl) return undefined;
  if (resumeUrl.includes("fl_attachment:")) return resumeUrl;

  const uploadIndex = resumeUrl.indexOf(UPLOAD_MARKER);
  if (uploadIndex === -1) return resumeUrl;

  const filename = resolveResumeFilename(resumeName, resumeUrl);
  const prefix = resumeUrl.slice(0, uploadIndex + UPLOAD_MARKER.length);
  const suffix = resumeUrl.slice(uploadIndex + UPLOAD_MARKER.length);

  return `${prefix}fl_attachment:${filename}/${suffix}`;
};
