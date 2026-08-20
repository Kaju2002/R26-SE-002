import { uploadJobImages } from "../config/multer.js";

const isMultipart = (req) =>
  (req.headers["content-type"] || "").includes("multipart/form-data");

const ensureBodyObject = (req) => {
  if (req.body == null || typeof req.body !== "object") {
    req.body = {};
  }
};

/**
 * Parse multipart job posts (company logo, job poster, and fields).
 * Skip for JSON/urlencoded so express.json() / express.urlencoded() bodies are preserved.
 */
export const optionalJobLogoUpload = (req, res, next) => {
  if (!isMultipart(req)) {
    ensureBodyObject(req);
    return next();
  }

  uploadJobImages(req, res, (err) => {
    if (err) return next(err);
    ensureBodyObject(req);
    next();
  });
};
