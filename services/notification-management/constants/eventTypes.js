export const EVENT_TYPES = {
  APPLICATION_CREATED: "application.created",
  APPLICATION_STATUS_UPDATED: "application.status.updated",
  AUTH_PASSWORD_UPDATED: "auth.password.updated",
  AUTH_ACCOUNT_CREATED: "auth.account.created",
  CHAT_MESSAGE_CREATED: "chat.message.created",
  JOB_CREATED: "job.created",
  JOB_FLAGGED_FOR_REVIEW: "job.flagged_for_review",
};

export const ROUTING_KEYS = Object.values(EVENT_TYPES);

export const EXCHANGE_NAME = "fraudaware.events";
export const EXCHANGE_TYPE = "topic";
export const QUEUE_NAME = "notification-service.queue";
