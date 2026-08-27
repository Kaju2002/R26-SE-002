import multer from "multer";
import path from "path";

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
]);

const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const ALLOWED_DOCUMENT_EXTENSIONS = new Set([".pdf", ".doc", ".docx"]);

const ALLOWED_AUDIO_MIME_TYPES = new Set([
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/aac",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/webm",
  "audio/ogg",
  "audio/x-wav",
  "audio/3gpp",
]);
const ALLOWED_AUDIO_EXTENSIONS = new Set([
  ".m4a",
  ".mp4",
  ".aac",
  ".mp3",
  ".wav",
  ".webm",
  ".ogg",
  ".3gp",
]);

const chatAttachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (file.fieldname === "image" && ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      callback(null, true);
      return;
    }
    const extension = path.extname(file.originalname || "").toLowerCase();
    if (
      file.fieldname === "document" &&
      ALLOWED_DOCUMENT_MIME_TYPES.has(file.mimetype) &&
      ALLOWED_DOCUMENT_EXTENSIONS.has(extension)
    ) {
      callback(null, true);
      return;
    }
    if (
      file.fieldname === "audio" &&
      (ALLOWED_AUDIO_MIME_TYPES.has(file.mimetype) ||
        ALLOWED_AUDIO_EXTENSIONS.has(extension) ||
        file.mimetype.startsWith("audio/"))
    ) {
      callback(null, true);
      return;
    }
    callback(
      new Error(
        "Invalid attachment. Use JPG, PNG, GIF, WebP, PDF, DOC, DOCX, or audio (m4a/mp3/webm/wav)."
      )
    );
  },
});

const uploadSingleChatAttachment = chatAttachmentUpload.fields([
  { name: "image", maxCount: 1 },
  { name: "document", maxCount: 1 },
  { name: "audio", maxCount: 1 },
]);

export const uploadChatAttachment = (req, res, next) => {
  uploadSingleChatAttachment(req, res, (error) => {
    if (error) {
      error.status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      return next(error);
    }

    const image = req.files?.image?.[0];
    const document = req.files?.document?.[0];
    const audio = req.files?.audio?.[0];
    const present = [image, document, audio].filter(Boolean);
    if (present.length > 1) {
      const attachmentError = new Error("Send only one attachment per message.");
      attachmentError.status = 400;
      return next(attachmentError);
    }
    if (image && image.size > 5 * 1024 * 1024) {
      const imageError = new Error("Images cannot exceed 5 MB.");
      imageError.status = 413;
      return next(imageError);
    }
    if (audio && audio.size > 8 * 1024 * 1024) {
      const audioError = new Error("Voice messages cannot exceed 8 MB.");
      audioError.status = 413;
      return next(audioError);
    }
    return next();
  });
};
