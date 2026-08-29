import mongoose from "mongoose";

export const INTERVIEW_TYPES = ["video", "phone", "onsite"];
export const INTERVIEW_STATUSES = [
  "scheduled",
  "completed",
  "cancelled",
  "no_show",
  "rescheduled",
];

/** Statuses that block scheduling another interview for the same application. */
export const ACTIVE_INTERVIEW_STATUSES = ["scheduled", "rescheduled"];

/** True when an interview should prevent scheduling another for the same application. */
export const isBlockingInterview = (interview, now = Date.now()) => {
  if (!ACTIVE_INTERVIEW_STATUSES.includes(interview?.status)) return false;
  const endsAt = new Date(interview.endsAt);
  return !Number.isNaN(endsAt.getTime()) && endsAt.getTime() > now;
};

const interviewSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: String,
      default: null,
      index: true,
    },
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
      index: true,
    },
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
      required: true,
      index: true,
    },
    candidateUserId: {
      type: String,
      required: true,
      index: true,
    },
    organizerId: {
      type: String,
      required: true,
      index: true,
    },
    candidateName: { type: String, required: true, trim: true },
    candidateEmail: { type: String, required: true, trim: true, lowercase: true },
    jobTitle: { type: String, default: "", trim: true },
    companyName: { type: String, default: "", trim: true },
    startsAt: { type: Date, required: true, index: true },
    endsAt: { type: Date, required: true },
    timezone: { type: String, default: "UTC", trim: true },
    type: {
      type: String,
      enum: INTERVIEW_TYPES,
      default: "video",
    },
    location: { type: String, default: "", trim: true },
    notes: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: INTERVIEW_STATUSES,
      default: "scheduled",
      index: true,
    },
    conferenceProvider: {
      type: String,
      default: null,
      trim: true,
    },
    conferenceUrl: {
      type: String,
      default: null,
      trim: true,
    },
    calendarEventId: {
      type: String,
      default: null,
      trim: true,
    },
    calendarId: {
      type: String,
      default: "primary",
      trim: true,
    },
    calendarHtmlLink: {
      type: String,
      default: null,
      trim: true,
    },
    inviteEmailSent: {
      type: Boolean,
      default: false,
    },
    reminder24hSentAt: {
      type: Date,
      default: null,
    },
    reminder1hSentAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

interviewSchema.index({ organizerId: 1, startsAt: 1 });
interviewSchema.index({ workspaceId: 1, startsAt: 1 });

const Interview = mongoose.model("Interview", interviewSchema);
export default Interview;
