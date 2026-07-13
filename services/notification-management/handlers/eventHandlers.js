import Notification from "../model/notificationModel.js";
import { EVENT_TYPES } from "../constants/eventTypes.js";
import {
  findApplicationNotification,
  hasProcessedEvent,
} from "../utils/idempotency.js";

const STATUS_TITLES = {
  sent: "Application Submitted",
  pending: "Application Under Review",
  accepted: "Application Accepted",
  rejected: "Application Rejected",
};

const STATUS_BODIES = {
  sent: (jobTitle, companyName) =>
    `Your application for ${jobTitle} at ${companyName} was sent.`,
  pending: (jobTitle, companyName) =>
    `Your application for ${jobTitle} at ${companyName} is now under review.`,
  accepted: (jobTitle, companyName) =>
    `Congratulations! Your application for ${jobTitle} at ${companyName} was accepted.`,
  rejected: (jobTitle, companyName) =>
    `Your application for ${jobTitle} at ${companyName} was not selected this time.`,
};

const buildApplicationCopy = (status, jobTitle, companyName) => {
  const safeStatus = STATUS_BODIES[status] ? status : "sent";
  return {
    title: STATUS_TITLES[safeStatus],
    body: STATUS_BODIES[safeStatus](jobTitle, companyName),
  };
};

const createNotification = async (data) => {
  try {
    return await Notification.create(data);
  } catch (error) {
    if (error.code === 11000) {
      return null;
    }
    throw error;
  }
};

const handleApplicationCreated = async (event) => {
  const payload = event.payload || {};
  const {
    applicationId,
    applicantId,
    jobId,
    jobTitle = "",
    companyName = "",
    companyLogo = null,
    status = "sent",
  } = payload;

  if (!applicationId || !applicantId) {
    throw new Error("application.created payload missing applicationId or applicantId");
  }

  if (await hasProcessedEvent(event.eventId)) {
    return { skipped: true, reason: "duplicate-event" };
  }

  const existing = await findApplicationNotification(applicantId, applicationId);
  if (existing) {
    return { skipped: true, reason: "duplicate-application" };
  }

  const copy = buildApplicationCopy(status, jobTitle, companyName);

  const notification = await createNotification({
    userId: String(applicantId),
    category: "applications",
    type: "application",
    title: copy.title,
    body: copy.body,
    metadata: {
      applicationId: String(applicationId),
      jobId: jobId ? String(jobId) : undefined,
      jobTitle,
      companyName,
      companyLogo,
      applicationStatus: status,
    },
    sourceEventId: event.eventId,
  });

  return { created: Boolean(notification) };
};

const handleApplicationStatusUpdated = async (event) => {
  const payload = event.payload || {};
  const {
    applicationId,
    applicantId,
    jobId,
    jobTitle = "",
    companyName = "",
    companyLogo = null,
    status = "pending",
  } = payload;

  if (!applicationId || !applicantId) {
    throw new Error(
      "application.status.updated payload missing applicationId or applicantId"
    );
  }

  if (await hasProcessedEvent(event.eventId)) {
    return { skipped: true, reason: "duplicate-event" };
  }

  const copy = buildApplicationCopy(status, jobTitle, companyName);
  const metadata = {
    applicationId: String(applicationId),
    jobId: jobId ? String(jobId) : undefined,
    jobTitle,
    companyName,
    companyLogo,
    applicationStatus: status,
  };

  const existing = await findApplicationNotification(applicantId, applicationId);

  if (existing) {
    existing.title = copy.title;
    existing.body = copy.body;
    existing.metadata = metadata;
    existing.read = false;
    existing.sourceEventId = event.eventId;
    await existing.save();
    return { updated: true };
  }

  const notification = await createNotification({
    userId: String(applicantId),
    category: "applications",
    type: "application",
    title: copy.title,
    body: copy.body,
    metadata,
    sourceEventId: event.eventId,
  });

  return { created: Boolean(notification) };
};

const handleAuthPasswordUpdated = async (event) => {
  const payload = event.payload || {};
  const { userId } = payload;

  if (!userId) {
    throw new Error("auth.password.updated payload missing userId");
  }

  if (await hasProcessedEvent(event.eventId)) {
    return { skipped: true, reason: "duplicate-event" };
  }

  const notification = await createNotification({
    userId: String(userId),
    category: "general",
    type: "auth",
    title: "Password Updated",
    body: "You have successfully updated your password.",
    sourceEventId: event.eventId,
  });

  return { created: Boolean(notification) };
};

const handleAuthAccountCreated = async (event) => {
  const payload = event.payload || {};
  const { userId } = payload;

  if (!userId) {
    throw new Error("auth.account.created payload missing userId");
  }

  if (await hasProcessedEvent(event.eventId)) {
    return { skipped: true, reason: "duplicate-event" };
  }

  const notification = await createNotification({
    userId: String(userId),
    category: "general",
    type: "auth",
    title: "Account Created",
    body: "You have successfully created an account on FraudAware. You can now apply for jobs with our services.",
    sourceEventId: event.eventId,
  });

  return { created: Boolean(notification) };
};

export const handleEvent = async (event) => {
  if (!event?.eventType) {
    throw new Error("Event envelope missing eventType");
  }

  switch (event.eventType) {
    case EVENT_TYPES.APPLICATION_CREATED:
      return handleApplicationCreated(event);
    case EVENT_TYPES.APPLICATION_STATUS_UPDATED:
      return handleApplicationStatusUpdated(event);
    case EVENT_TYPES.AUTH_PASSWORD_UPDATED:
      return handleAuthPasswordUpdated(event);
    case EVENT_TYPES.AUTH_ACCOUNT_CREATED:
      return handleAuthAccountCreated(event);
    default:
      return { skipped: true, reason: "unsupported-event" };
  }
};
