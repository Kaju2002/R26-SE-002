import Notification from "../model/notificationModel.js";

export const hasProcessedEvent = async (sourceEventId) => {
  if (!sourceEventId) return false;

  const existing = await Notification.findOne({ sourceEventId }).select("_id");
  return Boolean(existing);
};

export const findApplicationNotification = async (userId, applicationId) => {
  if (!userId || !applicationId) return null;

  return Notification.findOne({
    userId: String(userId),
    category: "applications",
    "metadata.applicationId": String(applicationId),
  });
};
