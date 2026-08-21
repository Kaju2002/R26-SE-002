/**
 * Interview reminder poller (P3).
 * Sends T-24h and T-1h reminders via Rabbit (email + in-app) and InChat.
 *
 * Test mode: set INTERVIEW_REMINDER_TEST_MODE=true to use T-5m and T-2m windows.
 */

import Interview from "../model/interviewModel.js";
import { EVENT_TYPES } from "../constants/eventTypes.js";
import { publishEvent } from "../utils/publishEvent.js";

const MS_MIN = 60 * 1000;
const MS_HOUR = 60 * MS_MIN;

const isTestMode = () =>
  String(process.env.INTERVIEW_REMINDER_TEST_MODE || "").toLowerCase() === "true" ||
  String(process.env.INTERVIEW_REMINDER_TEST_MODE || "") === "1";

/** Windows: { key, offsetMs, flagField } */
export const getReminderWindows = () => {
  if (isTestMode()) {
    return [
      { key: "24h", label: "in about 5 minutes", offsetMs: 5 * MS_MIN, flagField: "reminder24hSentAt" },
      { key: "1h", label: "in about 2 minutes", offsetMs: 2 * MS_MIN, flagField: "reminder1hSentAt" },
    ];
  }
  return [
    { key: "24h", label: "in 24 hours", offsetMs: 24 * MS_HOUR, flagField: "reminder24hSentAt" },
    { key: "1h", label: "in 1 hour", offsetMs: 1 * MS_HOUR, flagField: "reminder1hSentAt" },
  ];
};

const TOLERANCE_MS = () =>
  isTestMode() ? 90 * 1000 : 3 * MS_MIN;

const getChatBaseUrl = () =>
  process.env.CHAT_MANAGEMENT_BASE_URL?.trim().replace(/\/$/, "") || "";

const getInternalKey = () =>
  process.env.INTERNAL_SERVICE_KEY?.trim() ||
  process.env.CHAT_INTERNAL_SERVICE_KEY?.trim() ||
  "";

const formatWhen = (startsAt, timezone) => {
  try {
    return new Date(startsAt).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: timezone || undefined,
    });
  } catch {
    return new Date(startsAt).toISOString();
  }
};

const buildReminderCopy = (interview, window) => {
  const when = formatWhen(interview.startsAt, interview.timezone);
  const join = interview.conferenceUrl
    ? `\nJoin: ${interview.conferenceUrl}`
    : "";
  const title =
    window.key === "1h"
      ? `Interview starting soon: ${interview.jobTitle}`
      : `Interview reminder: ${interview.jobTitle}`;
  const body = `Hi ${interview.candidateName.split(/\s+/)[0] || "there"}, your interview for ${interview.jobTitle} at ${interview.companyName || "the company"} is ${window.label} (${when}, ${interview.timezone || "UTC"}).${join}`;
  return { title, body };
};

const sendInChatReminder = async (interview, copy) => {
  const base = getChatBaseUrl();
  const key = getInternalKey();
  if (!base || !key) {
    return { skipped: true, reason: "chat-not-configured" };
  }

  try {
    const response = await fetch(`${base}/api/chat/internal/interview-reminder`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-service-key": key,
      },
      body: JSON.stringify({
        applicationId: String(interview.applicationId),
        recruiterId: String(interview.organizerId),
        jobseekerId: String(interview.candidateUserId),
        jobId: String(interview.jobId),
        workspaceId: interview.workspaceId ? String(interview.workspaceId) : null,
        companyName: interview.companyName || null,
        body: copy.body,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        skipped: false,
        ok: false,
        message: data.message || `chat ${response.status}`,
      };
    }
    return { skipped: false, ok: true, conversationId: data.conversationId };
  } catch (error) {
    return { skipped: false, ok: false, message: error.message };
  }
};

const processInterviewWindow = async (interview, window, now) => {
  if (interview[window.flagField]) return { skipped: true, reason: "already-sent" };

  const starts = new Date(interview.startsAt).getTime();
  if (!Number.isFinite(starts)) return { skipped: true, reason: "bad-startsAt" };

  const target = starts - window.offsetMs;
  const tol = TOLERANCE_MS();
  if (now < target - tol || now > target + tol) {
    return { skipped: true, reason: "outside-window" };
  }

  const copy = buildReminderCopy(interview, window);

  // Mark first to reduce double-send under concurrent polls
  interview[window.flagField] = new Date(now);
  await interview.save();

  let rabbitOk = true;
  try {
    await publishEvent(EVENT_TYPES.INTERVIEW_REMINDER, {
      interviewId: String(interview._id),
      applicationId: String(interview.applicationId),
      applicantId: String(interview.candidateUserId),
      recruiterId: String(interview.organizerId),
      jobId: String(interview.jobId),
      workspaceId: interview.workspaceId ? String(interview.workspaceId) : null,
      jobTitle: interview.jobTitle || "",
      companyName: interview.companyName || "",
      candidateName: interview.candidateName,
      candidateEmail: interview.candidateEmail,
      startsAt: interview.startsAt?.toISOString?.() || interview.startsAt,
      timezone: interview.timezone || "UTC",
      conferenceUrl: interview.conferenceUrl || null,
      reminderKind: window.key,
      title: copy.title,
      body: copy.body,
    });
  } catch (error) {
    rabbitOk = false;
    console.warn(
      `[interview-reminders] Rabbit publish failed for ${interview._id}:`,
      error.message
    );
  }

  const chatResult = await sendInChatReminder(interview, copy);
  if (chatResult.ok === false) {
    console.warn(
      `[interview-reminders] InChat failed for ${interview._id}:`,
      chatResult.message
    );
  }

  return {
    skipped: false,
    interviewId: String(interview._id),
    kind: window.key,
    rabbitOk,
    chat: chatResult,
  };
};

export const runInterviewReminderPass = async () => {
  const now = Date.now();
  const windows = getReminderWindows();
  // Look ahead slightly past the longest window
  const maxOffset = Math.max(...windows.map((w) => w.offsetMs));
  const from = new Date(now);
  const to = new Date(now + maxOffset + TOLERANCE_MS());

  const interviews = await Interview.find({
    status: { $in: ["scheduled", "rescheduled"] },
    startsAt: { $gte: from, $lte: to },
  }).limit(200);

  const results = [];
  for (const interview of interviews) {
    for (const window of windows) {
      try {
        const result = await processInterviewWindow(interview, window, now);
        if (!result.skipped) results.push(result);
      } catch (error) {
        console.error(
          `[interview-reminders] Error ${interview._id} ${window.key}:`,
          error.message
        );
      }
    }
  }

  return {
    testMode: isTestMode(),
    checked: interviews.length,
    sent: results.length,
    results,
  };
};

let timer = null;

export const startInterviewReminderPoller = () => {
  const enabled =
    String(process.env.INTERVIEW_REMINDER_ENABLED || "true").toLowerCase() !==
    "false";
  if (!enabled) {
    console.log("[interview-reminders] Poller disabled");
    return;
  }

  const intervalMs = Math.max(
    Number(process.env.INTERVIEW_REMINDER_POLL_MS) || 60_000,
    15_000
  );

  const tick = async () => {
    try {
      const summary = await runInterviewReminderPass();
      if (summary.sent > 0) {
        console.log(
          `[interview-reminders] sent=${summary.sent} checked=${summary.checked} testMode=${summary.testMode}`
        );
      }
    } catch (error) {
      console.error("[interview-reminders] Pass failed:", error.message);
    }
  };

  // Delay first run slightly after boot
  setTimeout(() => {
    void tick();
    timer = setInterval(() => void tick(), intervalMs);
  }, 5_000);

  console.log(
    `[interview-reminders] Poller started (every ${intervalMs}ms, testMode=${isTestMode()})`
  );
};

export const stopInterviewReminderPoller = () => {
  if (timer) clearInterval(timer);
  timer = null;
};
