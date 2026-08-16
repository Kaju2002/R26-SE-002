import cloudinary from "../config/cloudinary.js";

/** Multipart filenames often arrive URL-encoded (%20 for spaces). */
const cleanFileName = (value, fallback) => {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  try {
    return decodeURIComponent(raw.replace(/\+/g, " "));
  } catch {
    return raw;
  }
};

export const uploadChatImage = async (file) => {
  if (!file?.buffer) return null;
  const uploaded = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "fraudaware/chat/attachments",
        resource_type: "image",
        allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    stream.end(file.buffer);
  });

  return {
    url: uploaded.secure_url,
    publicId: uploaded.public_id || null,
    fileName: cleanFileName(file.originalname, "chat-image.jpg"),
    mimeType: file.mimetype || "image/jpeg",
    size: Number(file.size) || 0,
  };
};

export const uploadChatDocument = async (file) => {
  if (!file?.buffer) return null;
  const fileName = cleanFileName(file.originalname, "document.pdf");
  const extension = fileName.split(".").pop()?.toLowerCase() || "pdf";
  const uploaded = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "fraudaware/chat/documents",
        resource_type: "raw",
        public_id: `document-${Date.now()}.${extension}`,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    stream.end(file.buffer);
  });

  return {
    url: uploaded.secure_url,
    publicId: uploaded.public_id || null,
    fileName,
    mimeType: file.mimetype || "application/pdf",
    size: Number(file.size) || 0,
  };
};

export const deleteUploadedAttachment = async (
  publicId,
  resourceType = "image"
) => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (error) {
    console.error("Could not clean up uploaded chat attachment:", error.message);
  }
};
