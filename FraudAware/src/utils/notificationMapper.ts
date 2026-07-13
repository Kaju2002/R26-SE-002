import type { AppNotification } from '../../data/notifications';
import type { ApplicationListItem } from '../../data/applicationNotifications';
import type {
  ApiApplicationNotification,
  ApiGeneralNotification,
  ApiNotification,
} from '../api/notificationApi';

function isGeneralNotification(
  notification: ApiNotification
): notification is ApiGeneralNotification {
  return 'category' in notification && 'body' in notification;
}

function isApplicationNotification(
  notification: ApiNotification
): notification is ApiApplicationNotification {
  return 'jobTitle' in notification && 'companyName' in notification;
}

export function mapApiApplicationNotificationToListItem(
  notification: ApiApplicationNotification
): ApplicationListItem {
  return {
    id: notification.id,
    jobTitle: notification.jobTitle,
    companyName: notification.companyName,
    status: notification.status,
    logo: notification.companyLogoUri
      ? { uri: notification.companyLogoUri }
      : undefined,
    fallback: notification.companyFallback,
  };
}

export function mapApiNotificationsToGeneralItems(
  notifications: ApiNotification[]
): AppNotification[] {
  return notifications.filter(isGeneralNotification);
}

export function mapApiNotificationsToApplicationItems(
  notifications: ApiNotification[]
): ApplicationListItem[] {
  return notifications
    .filter(isApplicationNotification)
    .map(mapApiApplicationNotificationToListItem);
}
