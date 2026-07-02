import cloudinary from "../config/cloudinary.js";

/**
 * Extract public_id from a Cloudinary URL.
 */
export const extractPublicId = (fileUrl) => {
  if (!fileUrl || !fileUrl.includes("cloudinary")) return null;

  const uploadIndex = fileUrl.indexOf("/upload/");
  if (uploadIndex === -1) return null;

  let path = fileUrl.substring(uploadIndex + "/upload/".length);
  path = path.replace(/^v\d+\//, "");
  return path.replace(/\.[^/.]+$/, "");
};

/**
 * Delete a file from Cloudinary by URL or public_id.
 */
export const deleteFile = async (fileUrl, resourceType = "image") => {
  try {
    if (!fileUrl) return null;

    const publicId = fileUrl.includes("cloudinary")
      ? extractPublicId(fileUrl)
      : fileUrl;

    if (!publicId) return null;

    return await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (error) {
    console.error("Error deleting file from Cloudinary:", error);
    throw error;
  }
};

/**
 * Get uploaded file URL from multer file object.
 */
export const getFileUrl = (file) => {
  if (!file) return null;
  return file.path || file.url || null;
};
