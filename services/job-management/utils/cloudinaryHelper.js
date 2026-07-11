export const getFileUrl = (file) => {
  if (!file) return null;
  return file.path || file.url || null;
};
