import Notification from "../model/notificationModel.js";
import { EVENT_TYPES } from "../constants/eventTypes.js";
import {
  findApplicationNotification,
  hasProcessedEvent,
} from "../utils/idempotency.js";
import { sendExpoPushToUser } from "../utils/expoPushClient.js";
import { findJobseekersMatchingSkills, listSuperadmins } from "../utils/userManagementClient.js";
import { sendApplicationThankYouEmail } from "../utils/sendApplicationThankYouEmail.js";
import { sendApplicationStatusEmail } from "../utils/sendApplicationStatusEmail.js";
import { sendInterviewReminderEmail } from "../utils/sendInterviewReminderEmail.js";

const STATUS_TITLES = {
  applied: "Application Submitted",
  screened: "Application Under Review",
  shortlisted: "You've Been Shortlisted",
  interview: "Interview Update",
  offered: "Job Offer",
  hired: "You're Hired",
  rejected: "Application Update",
  sent: "Application Submitted",
  pending: "Application Under Review",
  accepted: "You've Been Shortlisted",
};

const STATUS_BODIES = {
  applied: (jobTitle, companyName) =>
    `Your application for ${jobTitle} at ${companyName} was submitted.`,
  screened: (jobTitle, companyName) =>
    `Your application for ${jobTitle} at ${companyName} is under review.`,
  shortlisted: (jobTitle, companyName) =>
    `Great news — you've been shortlisted for ${jobTitle} at ${companyName}.`,
  interview: (jobTitle, companyName) =>
    `There's an interview update for ${jobTitle} at ${companyName}.`,
  offered: (jobTitle, companyName) =>
    `Congratulations! You received an offer for ${jobTitle} at ${companyName}.`,
  hired: (jobTitle, companyName) =>
    `Congratulations! You've been hired for ${jobTitle} at ${companyName}.`,
  rejected: (jobTitle, companyName) =>
    `Your application for ${jobTitle} at ${companyName} was not selected this time.`,
  sent: (jobTitle, companyName) =>
    `Your application for ${jobTitle} at ${companyName} was sent.`,
  pending: (jobTitle, companyName) =>
    `Your application for ${jobTitle} at ${companyName} is now under review.`,
  accepted: (jobTitle, companyName) =>
    `Great news — you've been shortlisted for ${jobTitle} at ${companyName}.`,
};

const buildApplicationCopy = (status, jobTitle, companyName) => {
  const safeStatus = STATUS_BODIES[status] ? status : "applied";
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
    applicantEmail = "",
    applicantName = "",
    companyWebsite = "",
    hrEmail = "",
    status = "applied",
  } = payload;

  if (!applicationId || !applicantId) {
    throw new Error("application.created payload missing applicationId or applicantId");
  }

  if (await hasProcessedEvent(event.eventId)) {
    return { skipped: true, reason: "duplicate-event" };
  }

  const existing = await findApplicationNotification(applicantId, applicationId);

  const copy = buildApplicationCopy(status, jobTitle, companyName);

  let notification = existing;
  if (!existing) {
    notification = await createNotification({
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
  }

  let emailResult = { skipped: true, reason: "not-attempted" };
  try {
    emailResult = await sendApplicationThankYouEmail({
      applicationId,
      applicantEmail,
      applicantName,
      jobTitle,
      companyName,
      companyWebsite,
      hrEmail,
      sourceEventId: event.eventId,
    });
  } catch (error) {
    console.error("Application thank-you email error:", error.message);
    emailResult = { sent: false, error: error.message };
  }

  return {
    created: Boolean(notification && !existing),
    email: emailResult,
  };
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
    applicantEmail = "",
    applicantName = "",
    companyWebsite = "",
    hrEmail = "",
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

  let notificationResult;
  if (existing) {
    existing.title = copy.title;
    existing.body = copy.body;
    existing.metadata = metadata;
    existing.read = false;
    existing.sourceEventId = event.eventId;
    await existing.save();
    notificationResult = { updated: true };
  } else {
    const notification = await createNotification({
      userId: String(applicantId),
      category: "applications",
      type: "application",
      title: copy.title,
      body: copy.body,
      metadata,
      sourceEventId: event.eventId,
    });
    notificationResult = { created: Boolean(notification) };
  }

  let emailResult = { skipped: true, reason: "not-attempted" };
  if (status === "offered" || status === "hired") {
    try {
      emailResult = await sendApplicationStatusEmail({
        applicationId,
        status,
        applicantEmail,
        applicantName,
        jobTitle,
        companyName,
        companyWebsite,
        hrEmail,
        sourceEventId: event.eventId,
      });
    } catch (error) {
      console.error("Application status email error:", error.message);
      emailResult = { sent: false, error: error.message };
    }
  }

  return { ...notificationResult, email: emailResult };
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

const handleChatMessageCreated = async (event) => {
  const payload = event.payload || {};
  const {
    recipientId,
    conversationId,
    messageId,
    applicationId,
    jobId,
    companyName = "Recruiter",
    jobTitle = "",
    preview = "",
    flagged = false,
  } = payload;

  if (!recipientId || !conversationId) {
    throw new Error(
      "chat.message.created payload missing recipientId or conversationId"
    );
  }

  if (await hasProcessedEvent(event.eventId)) {
    return { skipped: true, reason: "duplicate-event" };
  }

  const company = String(companyName || "Recruiter").trim() || "Recruiter";
  const messagePreview = String(preview || "").trim() || "New chat message";
  const roleHint = jobTitle ? ` · ${jobTitle}` : "";
  const isFlagged = Boolean(flagged);

  // Normal chat stays in Chat + push only so General is not flooded.
  // Flagged / possible-scam messages still land in General as safety alerts.
  const title = isFlagged
    ? "Possible scam message"
    : `New message from ${company}`;
  const body = isFlagged
    ? `${company}${roleHint}: ${messagePreview}`
    : messagePreview;

  let notification = null;
  if (isFlagged) {
    notification = await createNotification({
      userId: String(recipientId),
      category: "general",
      type: "scam",
      title,
      body,
      metadata: {
        conversationId: String(conversationId),
        messageId: messageId ? String(messageId) : undefined,
        applicationId: applicationId ? String(applicationId) : undefined,
        jobId: jobId ? String(jobId) : undefined,
        companyName: company,
        jobTitle,
        flagged: true,
      },
      sourceEventId: event.eventId,
    });
  }

  const pushResult = await sendExpoPushToUser(recipientId, {
    title,
    body,
    data: {
      type: isFlagged ? "scam_chat" : "chat",
      conversationId: String(conversationId),
      messageId: messageId ? String(messageId) : undefined,
      flagged: isFlagged,
    },
  });

  return {
    created: Boolean(notification),
    skippedInbox: !isFlagged,
    push: pushResult,
  };
};

const handleJobCreated = async (event) => {
  const payload = event.payload || {};
  const {
    jobId,
    jobTitle = "",
    companyName = "",
    companyLogo = null,
    skills = [],
    postedBy,
  } = payload;

  if (!jobId) {
    throw new Error("job.created payload missing jobId");
  }

  const jobSkills = Array.isArray(skills)
    ? skills.map((s) => String(s || "").trim()).filter(Boolean)
    : [];

  if (!jobSkills.length) {
    return { skipped: true, reason: "no-job-skills" };
  }

  const matches = await findJobseekersMatchingSkills(jobSkills, {
    excludeUserId: postedBy ? String(postedBy) : undefined,
    limit: 100,
  });

  if (!matches.length) {
    return { skipped: true, reason: "no-skill-matches" };
  }

  let createdCount = 0;

  for (const match of matches) {
    const userId = String(match.id || "").trim();
    if (!userId) continue;

    const matchedSkills = Array.isArray(match.matchedSkills)
      ? match.matchedSkills.map((s) => String(s).trim()).filter(Boolean)
      : [];
    const skillPreview = matchedSkills.slice(0, 3).join(", ");
    const title = "New job match for you";
    const body = skillPreview
      ? `${jobTitle || "A new job"} at ${companyName || "a company"} looks suitable — your skills match (${skillPreview}).`
      : `${jobTitle || "A new job"} at ${companyName || "a company"} looks suitable based on your profile skills.`;

    const sourceEventId = `${event.eventId}:${userId}`;

    const existing = await Notification.findOne({
      userId,
      type: "job",
      "metadata.jobId": String(jobId),
      sourceEventId,
    }).select("_id");
    if (existing) continue;

    const notification = await createNotification({
      userId,
      category: "general",
      type: "job",
      title,
      body,
      metadata: {
        jobId: String(jobId),
        jobTitle,
        companyName,
        companyLogo,
      },
      sourceEventId,
    });

    if (notification) {
      createdCount += 1;
      void sendExpoPushToUser(userId, {
        title,
        body,
        data: {
          type: "job_match",
          jobId: String(jobId),
        },
      });
    }
  }

  return { created: createdCount > 0, createdCount };
};

const handleJobFlaggedForReview = async (event) => {
  const payload = event.payload || {};
  const {
    jobId,
    jobTitle = "",
    companyName = "",
    companyLogo = null,
    prediction = "unknown",
    fakeProbability = null,
    message = "A job posting needs admin review.",
  } = payload;

  if (!jobId) {
    throw new Error("job.flagged_for_review payload missing jobId");
  }

  const admins = await listSuperadmins();
  if (!admins.length) {
    console.warn(
      "Notification service: no superadmins found for job.flagged_for_review"
    );
    return { skipped: true, reason: "no-superadmins" };
  }

  const score =
    typeof fakeProbability === "number"
      ? `${Math.round(fakeProbability * 100)}% fake score`
      : String(prediction || "flagged");
  const title = "Job posting needs review";
  const body = `${jobTitle || "A job"} at ${companyName || "a company"} was flagged (${score}). ${message}`.trim();

  let createdCount = 0;

  for (const admin of admins) {
    const userId = String(admin.id || "").trim();
    if (!userId) continue;

    const sourceEventId = `${event.eventId}:${userId}`;
    const notification = await createNotification({
      userId,
      category: "general",
      type: "moderation",
      title,
      body,
      metadata: {
        jobId: String(jobId),
        jobTitle,
        companyName,
        companyLogo,
      },
      sourceEventId,
    });

    if (notification) {
      createdCount += 1;
      void sendExpoPushToUser(userId, {
        title,
        body,
        data: {
          type: "job_moderation",
          jobId: String(jobId),
        },
      });
    }
  }

  return { created: createdCount > 0, createdCount };
};

const handleInterviewReminder = async (event) => {
  const payload = event.payload || {};
  const {
    interviewId,
    applicationId,
    applicantId,
    jobId,
    jobTitle = "",
    companyName = "",
    candidateName = "",
    candidateEmail = "",
    startsAt,
    timezone = "UTC",
    conferenceUrl = null,
    reminderKind = "24h",
    title = "",
    body = "",
  } = payload;

  if (!applicantId || !interviewId) {
    throw new Error("interview.reminder payload missing applicantId or interviewId");
  }

  if (await hasProcessedEvent(event.eventId)) {
    return { skipped: true, reason: "duplicate-event" };
  }

  const reminderTitle = title || "Interview reminder";
  const reminderBody =
    body || `Your interview for ${jobTitle} is coming up.`;

  // General tab shows title/body; Applications tab only shows job/status cards.
  const notification = await createNotification({
    userId: String(applicantId),
    category: "general",
    type: "system",
    title: reminderTitle,
    body: reminderBody,
    metadata: {
      applicationId: applicationId ? String(applicationId) : undefined,
      jobId: jobId ? String(jobId) : undefined,
      jobTitle,
      companyName,
      applicationStatus: "interview",
    },
    sourceEventId: event.eventId,
  });

  let emailResult = { skipped: true, reason: "not-attempted" };
  try {
    emailResult = await sendInterviewReminderEmail({
      candidateEmail,
      candidateName,
      jobTitle,
      companyName,
      startsAt,
      timezone,
      conferenceUrl,
      reminderKind,
      title: reminderTitle,
      body: reminderBody,
    });
  } catch (error) {
    console.error("Interview reminder email error:", error.message);
    emailResult = { skipped: false, ok: false, message: error.message };
  }

  try {
    await sendExpoPushToUser(String(applicantId), {
      title: reminderTitle,
      body: reminderBody,
      data: {
        type: "interview_reminder",
        interviewId: String(interviewId),
        applicationId: applicationId ? String(applicationId) : undefined,
      },
    });
  } catch (error) {
    console.warn("Interview reminder push warning:", error.message);
  }

  return {
    created: Boolean(notification),
    emailResult,
    reminderKind,
  };
};

const handleSupportTicketCreated = async (event) => {
  const payload = event.payload || {};
  const {
    ticketId,
    ticketNumber = "",
    subject = "",
    requesterName = "",
  } = payload;

  if (!ticketId) {
    throw new Error("support.ticket.created payload missing ticketId");
  }

  const admins = await listSuperadmins();
  if (!admins.length) {
    console.warn(
      "Notification service: no superadmins found for support.ticket.created"
    );
    return { skipped: true, reason: "no-superadmins" };
  }

  const title = "New support ticket";
  const body = `${requesterName || "A user"} opened ${ticketNumber || "a ticket"}: ${subject || "Support request"}`.trim();

  let createdCount = 0;

  for (const admin of admins) {
    const userId = String(admin.id || "").trim();
    if (!userId) continue;

    const sourceEventId = `${event.eventId}:${userId}`;
    const notification = await createNotification({
      userId,
      category: "general",
      type: "support",
      title,
      body,
      metadata: {
        ticketId: String(ticketId),
        ticketNumber: ticketNumber ? String(ticketNumber) : undefined,
      },
      sourceEventId,
    });

    if (notification) {
      createdCount += 1;
      void sendExpoPushToUser(userId, {
        title,
        body,
        data: {
          type: "support_ticket_created",
          ticketId: String(ticketId),
          ticketNumber: ticketNumber ? String(ticketNumber) : undefined,
        },
      });
    }
  }

  return { created: createdCount > 0, createdCount };
};

const handleSupportTicketReplied = async (event) => {
  const payload = event.payload || {};
  const {
    ticketId,
    ticketNumber = "",
    subject = "",
    requesterUserId,
    adminName = "Support",
    replyPreview = "",
  } = payload;

  if (!ticketId || !requesterUserId) {
    throw new Error(
      "support.ticket.replied payload missing ticketId or requesterUserId"
    );
  }

  if (await hasProcessedEvent(event.eventId)) {
    return { skipped: true, reason: "duplicate-event" };
  }

  const title = "Support replied to your ticket";
  const preview = replyPreview ? `: ${replyPreview}` : "";
  const body = `${adminName} replied to ${ticketNumber || "your ticket"}${preview}`.trim();

  const notification = await createNotification({
    userId: String(requesterUserId),
    category: "general",
    type: "support",
    title,
    body,
    metadata: {
      ticketId: String(ticketId),
      ticketNumber: ticketNumber ? String(ticketNumber) : undefined,
    },
    sourceEventId: event.eventId,
  });

  if (notification) {
    void sendExpoPushToUser(String(requesterUserId), {
      title,
      body,
      data: {
        type: "support_reply",
        ticketId: String(ticketId),
        ticketNumber: ticketNumber ? String(ticketNumber) : undefined,
        subject: subject ? String(subject) : undefined,
      },
    });
  }

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
    case EVENT_TYPES.CHAT_MESSAGE_CREATED:
      return handleChatMessageCreated(event);
    case EVENT_TYPES.JOB_CREATED:
      return handleJobCreated(event);
    case EVENT_TYPES.JOB_FLAGGED_FOR_REVIEW:
      return handleJobFlaggedForReview(event);
    case EVENT_TYPES.INTERVIEW_REMINDER:
      return handleInterviewReminder(event);
    case EVENT_TYPES.SUPPORT_TICKET_CREATED:
      return handleSupportTicketCreated(event);
    case EVENT_TYPES.SUPPORT_TICKET_REPLIED:
      return handleSupportTicketReplied(event);
    default:
      return { skipped: true, reason: "unsupported-event" };
  }
};
