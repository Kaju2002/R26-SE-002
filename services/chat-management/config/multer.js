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
    callback(
      new Error(
        "Invalid attachment. Use JPG, PNG, GIF, WebP, PDF, DOC, or DOCX."
      )
    );
  },
});

const uploadSingleChatAttachment = chatAttachmentUpload.fields([
  { name: "image", maxCount: 1 },
  { name: "document", maxCount: 1 },
]);

export const uploadChatAttachment = (req, res, next) => {
  uploadSingleChatAttachment(req, res, (error) => {
    if (error) {
      error.status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      return next(error);
    }

    const image = req.files?.image?.[0];
    const document = req.files?.document?.[0];
    if (image && document) {
      const attachmentError = new Error("Send only one attachment per message.");
      attachmentError.status = 400;
      return next(attachmentError);
    }
    if (image && image.size > 5 * 1024 * 1024) {
      const imageError = new Error("Images cannot exceed 5 MB.");
      imageError.status = 413;
      return next(imageError);
    }
    return next();
  });
};
