import Notification from "../model/notificationModel.js";
import { formatNotificationList } from "../utils/formatNotification.js";
import { NOTIFICATION_CATEGORIES } from "../model/notificationModel.js";

const parsePagination = (query) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 50);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

const parseCategory = (value) => {
  const category = String(value || "").trim();
  if (!category) return null;
  if (!NOTIFICATION_CATEGORIES.includes(category)) return null;
  return category;
};

const buildUserFilter = (userId, category) => {
  const filter = { userId: String(userId) };
  if (category) filter.category = category;
  return filter;
};

export const listNotifications = async (req, res) => {
  try {
    const category = parseCategory(req.query.category);
    if (req.query.category && !category) {
      return res.status(400).json({
        success: false,
        message: "Invalid category. Use general or applications.",
      });
    }

    const { page, limit, skip } = parsePagination(req.query);
    const filter = buildUserFilter(req.userId, category);

    const [notifications, total] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Notification.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Notifications fetched successfully",
      notifications: formatNotificationList(notifications),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error("List notifications error:", error);
    return res.status(500).json({
      success: false,
      message: "Error while fetching notifications",
      error: error.message,
    });
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: { read: true } },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification marked as read",
    });
  } catch (error) {
    console.error("Mark notification read error:", error);
    return res.status(500).json({
      success: false,
      message: "Error while updating notification",
      error: error.message,
    });
  }
};

export const markAllNotificationsRead = async (req, res) => {
  try {
    const category = parseCategory(req.query.category);
    if (req.query.category && !category) {
      return res.status(400).json({
        success: false,
        message: "Invalid category. Use general or applications.",
      });
    }

    const filter = { ...buildUserFilter(req.userId, category), read: false };
    const result = await Notification.updateMany(filter, { $set: { read: true } });

    return res.status(200).json({
      success: true,
      message: "Notifications marked as read",
      updatedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Mark all notifications read error:", error);
    return res.status(500).json({
      success: false,
      message: "Error while updating notifications",
      error: error.message,
    });
  }
};

export const deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (error) {
    console.error("Delete notification error:", error);
    return res.status(500).json({
      success: false,
      message: "Error while deleting notification",
      error: error.message,
    });
  }
};

export const clearNotifications = async (req, res) => {
  try {
    const category = parseCategory(req.query.category);
    if (req.query.category && !category) {
      return res.status(400).json({
        success: false,
        message: "Invalid category. Use general or applications.",
      });
    }

    const filter = buildUserFilter(req.userId, category);
    const result = await Notification.deleteMany(filter);

    return res.status(200).json({
      success: true,
      message: "Notifications cleared successfully",
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Clear notifications error:", error);
    return res.status(500).json({
      success: false,
      message: "Error while clearing notifications",
      error: error.message,
    });
  }
};
