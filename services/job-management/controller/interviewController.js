import Interview, {
  ACTIVE_INTERVIEW_STATUSES,
  INTERVIEW_STATUSES,
  INTERVIEW_TYPES,
} from "../model/interviewModel.js";
import Application from "../model/applicationModel.js";
import Job from "../model/jobModel.js";
import { EVENT_TYPES } from "../constants/eventTypes.js";
import { publishEvent } from "../utils/publishEvent.js";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  sendInviteEmail,
  updateCalendarEvent,
} from "../config/emailManagementClient.js";
import {
  buildInterviewInviteHtml,
  buildInterviewInviteSubject,
} from "../config/interviewInviteTemplate.js";
import {
  getOrCreateHomeWorkspace,
  WorkspaceAccessError,
} from "../service/employerWorkspaceService.js";

const isValidObjectId = (id) => /^[a-fA-F0-9]{24}$/.test(String(id));

const rejectPastStart = (startsAt, res) => {
  if (startsAt.getTime() < Date.now()) {
    res.status(400).json({
      success: false,
      message: "Interview cannot be scheduled in the past",
    });
    return true;
  }
  return false;
};

const toIso = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const formatInterview = (interview) => ({
  id: String(interview._id),
  workspaceId: interview.workspaceId ? String(interview.workspaceId) : null,
  jobId: String(interview.jobId),
  applicationId: String(interview.applicationId),
  candidateUserId: interview.candidateUserId,
  organizerId: interview.organizerId,
  candidateName: interview.candidateName,
  candidateEmail: interview.candidateEmail,
  jobTitle: interview.jobTitle || "",
  companyName: interview.companyName || "",
  startsAt: toIso(interview.startsAt),
  endsAt: toIso(interview.endsAt),
  timezone: interview.timezone || "UTC",
  type: interview.type,
  location: interview.location || "",
  notes: interview.notes || "",
  status: interview.status,
  conferenceProvider: interview.conferenceProvider || null,
  conferenceUrl: interview.conferenceUrl || null,
  calendarEventId: interview.calendarEventId || null,
  calendarId: interview.calendarId || "primary",
  calendarHtmlLink: interview.calendarHtmlLink || null,
  inviteEmailSent: Boolean(interview.inviteEmailSent),
  createdAt: toIso(interview.createdAt),
  updatedAt: toIso(interview.updatedAt),
});

const buildCalendarEventTitle = (application, job) => {
  const role = String(job?.title || "Interview").trim() || "Interview";
  const company = String(job?.companyName || "").trim();
  if (company) {
    return `Interview: ${role} at ${company}`;
  }
  const candidate = String(application?.fullName || "Candidate").trim() || "Candidate";
  return `Interview: ${candidate} — ${role}`;
};

const buildInviteBody = (interview, job = null) =>
  buildInterviewInviteHtml({
    candidateName: interview.candidateName,
    jobTitle: interview.jobTitle || job?.title,
    companyName: interview.companyName || job?.companyName,
    startsAt: interview.startsAt,
    timezone: interview.timezone,
    type: interview.type,
    conferenceUrl: interview.conferenceUrl,
    location: interview.location,
    notes: interview.notes,
    companyWebsite: job?.contact?.website || "",
  });

const assertJobOwner = async (req, application) => {
  const job = await Job.findById(application.jobId);
  if (!job) {
    const err = new Error("Job not found for this application");
    err.status = 404;
    throw err;
  }
  if (String(job.postedBy) !== String(req.userId)) {
    const err = new Error("Only the job owner can manage interviews for this applicant");
    err.status = 403;
    throw err;
  }

  const home = await getOrCreateHomeWorkspace(req.user);
  if (job.workspaceId && String(job.workspaceId) !== String(home._id)) {
    // Still allow if organizer owns the job (postedBy check passed)
  }

  return { job, home };
};

/** POST /api/jobs/interviews */
export const createInterview = async (req, res) => {
  try {
    const applicationId = String(req.body?.applicationId || "").trim();
    const timezone = String(req.body?.timezone || "UTC").trim() || "UTC";
    const type = String(req.body?.type || "video").trim().toLowerCase();
    const location = String(req.body?.location || "").trim();
    const notes = String(req.body?.notes || "").trim();
    const manualConferenceUrl = String(req.body?.conferenceUrl || "").trim() || null;
    const conferencingProvider = req.body?.conferencingProvider;
    const sendInvite = req.body?.sendInvite !== false;
    const addConferencing = req.body?.addConferencing !== false;

    const startsAt = new Date(req.body?.startsAt);
    const endsAt = new Date(
      req.body?.endsAt ||
        (Number.isFinite(startsAt.getTime())
          ? startsAt.getTime() + 60 * 60 * 1000
          : NaN)
    );

    if (!isValidObjectId(applicationId)) {
      return res.status(400).json({
        success: false,
        message: "Valid applicationId is required",
      });
    }
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Valid startsAt and endsAt are required",
      });
    }
    if (endsAt.getTime() <= startsAt.getTime()) {
      return res.status(400).json({
        success: false,
        message: "endsAt must be after startsAt",
      });
    }
    if (rejectPastStart(startsAt, res)) {
      return;
    }
    if (!INTERVIEW_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `type must be one of: ${INTERVIEW_TYPES.join(", ")}`,
      });
    }

    const application = await Application.findById(applicationId);
    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    const { job, home } = await assertJobOwner(req, application);

    const existingActive = await Interview.findOne({
      applicationId: application._id,
      status: { $in: ACTIVE_INTERVIEW_STATUSES },
      endsAt: { $gt: new Date() },
    })
      .select("_id")
      .lean();

    if (existingActive) {
      return res.status(409).json({
        success: false,
        message:
          "An interview is already scheduled for this applicant. Reschedule or cancel the existing one.",
        code: "INTERVIEW_ALREADY_EXISTS",
        existingInterviewId: String(existingActive._id),
      });
    }

    const authHeader = req.authorizationHeader || req.headers.authorization;
    let calendarEvent = null;
    let calendarWarning = null;

    if (type === "video" || addConferencing) {
      const title = buildCalendarEventTitle(application, job);
      const description = [
        `Interview for ${job.title} at ${job.companyName || ""}.`,
        notes ? `Notes: ${notes}` : "",
        `Candidate: ${application.fullName} <${application.email}>`,
      ]
        .filter(Boolean)
        .join("\n");

      const created = await createCalendarEvent(authHeader, {
        title,
        description,
        location: type === "onsite" ? location : undefined,
        startTime: Math.floor(startsAt.getTime() / 1000),
        endTime: Math.floor(endsAt.getTime() / 1000),
        timezone,
        participants: [
          { email: application.email, name: application.fullName },
        ],
        addConferencing: type === "video" && addConferencing,
        conferencingProvider,
        calendarId: "primary",
      }).catch((error) => ({
        ok: false,
        status: 500,
        message: error.message || "Calendar service unavailable",
      }));

      if (created.ok) {
        calendarEvent = created.event;
      } else {
        calendarWarning = created.message;
        // Allow scheduling without mailbox if recruiter provided a manual link or non-video
        if (type === "video" && !manualConferenceUrl) {
          return res.status(created.status || 400).json({
            success: false,
            message:
              created.message ||
              "Connect mailbox (Google/Microsoft) to create Meet/Teams, or paste a conference URL.",
            code: "CALENDAR_REQUIRED",
          });
        }
      }
    }

    const interview = await Interview.create({
      workspaceId: application.workspaceId || job.workspaceId || String(home._id),
      jobId: job._id,
      applicationId: application._id,
      candidateUserId: application.applicantId,
      organizerId: req.userId,
      candidateName: application.fullName,
      candidateEmail: application.email,
      jobTitle: job.title,
      companyName: job.companyName || "",
      startsAt,
      endsAt,
      timezone,
      type,
      location,
      notes,
      status: "scheduled",
      conferenceProvider:
        calendarEvent?.conferenceProvider ||
        (manualConferenceUrl ? "manual" : null),
      conferenceUrl: calendarEvent?.conferenceUrl || manualConferenceUrl,
      calendarEventId: calendarEvent?.id || null,
      calendarId: calendarEvent?.calendarId || "primary",
      calendarHtmlLink: calendarEvent?.htmlLink || null,
      inviteEmailSent: false,
    });

    const previousStatus = application.status;
    if (application.status !== "interview") {
      application.status = "interview";
      await application.save();
      await publishEvent(EVENT_TYPES.APPLICATION_STATUS_UPDATED, {
        applicationId: String(application._id),
        applicantId: application.applicantId,
        recruiterId: job.postedBy,
        jobId: String(job._id),
        workspaceId: application.workspaceId
          ? String(application.workspaceId)
          : job.workspaceId
            ? String(job.workspaceId)
            : null,
        jobTitle: job.title,
        companyName: job.companyName,
        companyLogo: job.companyLogo || null,
        applicantEmail: application.email || "",
        applicantName: application.fullName || "",
        companyWebsite: job.contact?.website?.trim() || "",
        hrEmail: job.contact?.email?.trim() || "",
        status: application.status,
        previousStatus,
      });
    }

    let inviteWarning = null;
    const calendarInviteSent = Boolean(calendarEvent?.id);
    const shouldSendCustomInvite = sendInvite && !calendarInviteSent;

    if (shouldSendCustomInvite) {
      const invite = await sendInviteEmail(authHeader, {
        to: application.email,
        subject: buildInterviewInviteSubject(job.title, job.companyName),
        body: buildInviteBody(interview, job),
        applicationId: String(application._id),
      }).catch((error) => ({
        ok: false,
        message: error.message,
      }));

      if (invite.ok) {
        interview.inviteEmailSent = true;
        await interview.save();
      } else {
        inviteWarning = invite.message || "Invite email could not be sent";
      }
    } else if (sendInvite && calendarInviteSent) {
      interview.inviteEmailSent = true;
      await interview.save();
    }

    return res.status(201).json({
      success: true,
      message: "Interview scheduled",
      interview: formatInterview(interview),
      warnings: [calendarWarning, inviteWarning].filter(Boolean),
    });
  } catch (error) {
    console.error("Create interview error:", error);

    if (error instanceof WorkspaceAccessError) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Could not schedule interview",
    });
  }
};

/** GET /api/jobs/interviews */
export const listInterviews = async (req, res) => {
  try {
    const status = String(req.query.status || "scheduled").trim();
    const from = req.query.from ? new Date(String(req.query.from)) : null;
    const to = req.query.to ? new Date(String(req.query.to)) : null;
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);

    const filter = { organizerId: String(req.userId) };

    if (status && status !== "all") {
      if (!INTERVIEW_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Use all or one of: ${INTERVIEW_STATUSES.join(", ")}`,
        });
      }
      filter.status = status;
    }

    if (from && !Number.isNaN(from.getTime())) {
      filter.startsAt = { ...(filter.startsAt || {}), $gte: from };
    }
    if (to && !Number.isNaN(to.getTime())) {
      filter.startsAt = { ...(filter.startsAt || {}), $lte: to };
    }

    const interviews = await Interview.find(filter)
      .sort({ startsAt: 1 })
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      interviews: interviews.map((row) => formatInterview(row)),
    });
  } catch (error) {
    console.error("List interviews error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Could not list interviews",
    });
  }
};

/** GET /api/jobs/interviews/:interviewId */
export const getInterview = async (req, res) => {
  try {
    const { interviewId } = req.params;
    if (!isValidObjectId(interviewId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid interview id",
      });
    }

    const interview = await Interview.findById(interviewId);
    if (!interview) {
      return res.status(404).json({
        success: false,
        message: "Interview not found",
      });
    }
    if (String(interview.organizerId) !== String(req.userId)) {
      return res.status(403).json({
        success: false,
        message: "Not allowed to view this interview",
      });
    }

    return res.status(200).json({
      success: true,
      interview: formatInterview(interview),
    });
  } catch (error) {
    console.error("Get interview error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Could not load interview",
    });
  }
};

/** PATCH /api/jobs/interviews/:interviewId — status / notes / reschedule */
export const updateInterview = async (req, res) => {
  try {
    const { interviewId } = req.params;
    if (!isValidObjectId(interviewId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid interview id",
      });
    }

    const interview = await Interview.findById(interviewId);
    if (!interview) {
      return res.status(404).json({
        success: false,
        message: "Interview not found",
      });
    }
    if (String(interview.organizerId) !== String(req.userId)) {
      return res.status(403).json({
        success: false,
        message: "Not allowed to update this interview",
      });
    }

    const nextStatus = req.body?.status
      ? String(req.body.status).trim()
      : null;
    if (nextStatus) {
      if (!INTERVIEW_STATUSES.includes(nextStatus)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Use: ${INTERVIEW_STATUSES.join(", ")}`,
        });
      }
      interview.status = nextStatus;
    }

    if (typeof req.body?.notes === "string") {
      interview.notes = req.body.notes.trim();
    }
    if (typeof req.body?.outcome === "string") {
      interview.notes = [interview.notes, `Outcome: ${req.body.outcome.trim()}`]
        .filter(Boolean)
        .join("\n");
    }

    const hasReschedule =
      req.body?.startsAt != null || req.body?.endsAt != null;
    let calendarWarning = null;

    if (hasReschedule) {
      if (interview.status === "cancelled") {
        return res.status(400).json({
          success: false,
          message: "Cannot reschedule a cancelled interview",
        });
      }

      const startsAt = new Date(req.body?.startsAt || interview.startsAt);
      const endsAt = new Date(req.body?.endsAt || interview.endsAt);
      const timezone =
        String(req.body?.timezone || interview.timezone || "UTC").trim() || "UTC";

      if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Valid startsAt and endsAt are required",
        });
      }
      if (endsAt.getTime() <= startsAt.getTime()) {
        return res.status(400).json({
          success: false,
          message: "endsAt must be after startsAt",
        });
      }
      if (rejectPastStart(startsAt, res)) {
        return;
      }

      const authHeader = req.authorizationHeader || req.headers.authorization;
      if (interview.calendarEventId) {
        const updated = await updateCalendarEvent(
          authHeader,
          interview.calendarEventId,
          {
            calendarId: interview.calendarId || "primary",
            startTime: Math.floor(startsAt.getTime() / 1000),
            endTime: Math.floor(endsAt.getTime() / 1000),
            timezone,
          }
        ).catch((error) => ({
          ok: false,
          message: error.message || "Calendar update failed",
        }));

        if (!updated.ok) {
          calendarWarning = updated.message;
        }
      }

      interview.startsAt = startsAt;
      interview.endsAt = endsAt;
      interview.timezone = timezone;
      if (interview.status === "scheduled" || interview.status === "rescheduled") {
        interview.status = "scheduled";
      }
      // Reschedule invalidates prior reminder sends so new windows can fire
      interview.reminder24hSentAt = null;
      interview.reminder1hSentAt = null;
    }

    await interview.save();

    return res.status(200).json({
      success: true,
      interview: formatInterview(interview),
      warnings: [calendarWarning].filter(Boolean),
    });
  } catch (error) {
    console.error("Update interview error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Could not update interview",
    });
  }
};

/** POST /api/jobs/interviews/reminders/run — manual poller pass (testing / ops) */
export const runInterviewRemindersNow = async (req, res) => {
  try {
    const { runInterviewReminderPass } = await import(
      "../jobs/interviewReminderPoller.js"
    );
    const summary = await runInterviewReminderPass();
    return res.status(200).json({
      success: true,
      ...summary,
    });
  } catch (error) {
    console.error("Run interview reminders error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Could not run interview reminders",
    });
  }
};

/** POST /api/jobs/interviews/:interviewId/cancel */
export const cancelInterview = async (req, res) => {
  try {
    const { interviewId } = req.params;
    if (!isValidObjectId(interviewId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid interview id",
      });
    }

    const interview = await Interview.findById(interviewId);
    if (!interview) {
      return res.status(404).json({
        success: false,
        message: "Interview not found",
      });
    }
    if (String(interview.organizerId) !== String(req.userId)) {
      return res.status(403).json({
        success: false,
        message: "Not allowed to cancel this interview",
      });
    }

    if (interview.status === "cancelled") {
      return res.status(200).json({
        success: true,
        interview: formatInterview(interview),
      });
    }

    const authHeader = req.authorizationHeader || req.headers.authorization;
    if (interview.calendarEventId) {
      await deleteCalendarEvent(
        authHeader,
        interview.calendarEventId,
        interview.calendarId || "primary"
      ).catch((error) => {
        console.warn("Calendar delete warning:", error.message);
      });
    }

    interview.status = "cancelled";
    await interview.save();

    const revertStatus = req.body?.revertToShortlisted !== false;
    if (revertStatus) {
      const application = await Application.findById(interview.applicationId);
      const job = application ? await Job.findById(application.jobId) : null;
      if (application && job && application.status === "interview") {
        application.status = "shortlisted";
        await application.save();
        await publishEvent(EVENT_TYPES.APPLICATION_STATUS_UPDATED, {
          applicationId: String(application._id),
          applicantId: application.applicantId,
          recruiterId: job.postedBy,
          jobId: String(job._id),
          workspaceId: application.workspaceId
            ? String(application.workspaceId)
            : null,
          jobTitle: job.title,
          companyName: job.companyName,
          companyLogo: job.companyLogo || null,
          applicantEmail: application.email || "",
          applicantName: application.fullName || "",
          companyWebsite: job.contact?.website?.trim() || "",
          hrEmail: job.contact?.email?.trim() || "",
          status: application.status,
          previousStatus: "interview",
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Interview cancelled",
      interview: formatInterview(interview),
    });
  } catch (error) {
    console.error("Cancel interview error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Could not cancel interview",
    });
  }
};
