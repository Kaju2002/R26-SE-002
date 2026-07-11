import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "./cloudinary.js";

const logoStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "fraudaware/jobs/logos",
    resource_type: "image",
    allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
  },
});

const logoUpload = multer({
  storage: logoStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/jpg"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only images are allowed."));
    }
  },
});

export const uploadJobLogo = logoUpload.single("logo");

const resumeStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "fraudaware/jobs/applications/resumes",
    resource_type: "raw",
    allowed_formats: ["pdf", "doc", "docx"],
  },
});

const resumeUpload = multer({
  storage: resumeStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only PDF/DOC/DOCX are allowed."));
    }
  },
});

export const uploadApplicationResume = resumeUpload.single("resume");
