import { uploadApplicationResume } from "../config/multer.js";

const isMultipart = (req) =>
  (req.headers["content-type"] || "").includes("multipart/form-data");

const ensureBodyObject = (req) => {
  if (req.body == null || typeof req.body !== "object") {
    req.body = {};
  }
};

/**
 * Parse multipart job applications (resume + fields). Skip for JSON/urlencoded.
 */
export const optionalResumeUpload = (req, res, next) => {
  if (!isMultipart(req)) {
    ensureBodyObject(req);
    return next();
  }

  uploadApplicationResume(req, res, (err) => {
    if (err) return next(err);
    ensureBodyObject(req);
    next();
  });
};
