export const getFileUrl = (file) => {
  if (!file) return null;
  return file.path || file.url || null;
};

export const getUploadedFile = (req, fieldName) => {
  const files = req?.files;
  if (files && !Array.isArray(files) && files[fieldName]) {
    const list = files[fieldName];
    return Array.isArray(list) ? list[0] : list;
  }
  if (Array.isArray(files)) {
    return files.find((file) => file.fieldname === fieldName) || null;
  }
  if (req?.file && (!fieldName || req.file.fieldname === fieldName)) {
    return req.file;
  }
  return null;
};
