const FALLBACK_PALETTE = [
  { bg: "#FBE0B6", color: "#7A5418" },
  { bg: "#1F2A6E", color: "#FFFFFF" },
  { bg: "#FFE091", color: "#5C3F00" },
  { bg: "#D8E1FF", color: "#202871" },
];

export const buildLogoFallback = (name) => {
  if (!name?.trim()) return undefined;

  const words = name.trim().split(/\s+/).filter(Boolean);
  const text =
    words.length >= 2
      ? `${words[0][0]}${words[1][0]}`.toUpperCase()
      : name.slice(0, 2).toUpperCase();

  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const palette = FALLBACK_PALETTE[Math.abs(hash) % FALLBACK_PALETTE.length];

  return { text, bg: palette.bg, color: palette.color };
};

const formatDisplayDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const formatDisplayTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
};

export const formatGeneralNotification = (notification) => {
  const createdAt = notification.createdAt || new Date();
  const metadata = notification.metadata || {};

  return {
    id: String(notification._id),
    category: notification.category,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    date: formatDisplayDate(createdAt),
    time: formatDisplayTime(createdAt),
    read: Boolean(notification.read),
    conversationId: metadata.conversationId
      ? String(metadata.conversationId)
      : undefined,
    jobId: metadata.jobId ? String(metadata.jobId) : undefined,
    ticketId: metadata.ticketId ? String(metadata.ticketId) : undefined,
    ticketNumber: metadata.ticketNumber
      ? String(metadata.ticketNumber)
      : undefined,
    flagged: Boolean(metadata.flagged),
  };
};

export const formatApplicationNotification = (notification) => {
  const metadata = notification.metadata || {};
  const companyName = metadata.companyName || "";
  const companyLogo = metadata.companyLogo || null;

  return {
    id: String(notification._id),
    jobTitle: metadata.jobTitle || notification.title,
    companyName,
    status: metadata.applicationStatus || "sent",
    companyLogoUri: companyLogo || undefined,
    companyFallback: companyLogo ? undefined : buildLogoFallback(companyName),
    read: Boolean(notification.read),
    createdAt: notification.createdAt
      ? new Date(notification.createdAt).toISOString()
      : undefined,
  };
};

export const formatNotification = (notification) => {
  if (notification.category === "applications") {
    return formatApplicationNotification(notification);
  }

  return formatGeneralNotification(notification);
};

export const formatNotificationList = (notifications) =>
  notifications.map((notification) => formatNotification(notification));
