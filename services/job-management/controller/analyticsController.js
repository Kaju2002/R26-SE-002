import Application from "../model/applicationModel.js";
import Job from "../model/jobModel.js";
import Interview from "../model/interviewModel.js";
import {
  getOrCreateHomeWorkspace,
  WorkspaceAccessError,
} from "../service/employerWorkspaceService.js";

const PIPELINE = [
  "applied",
  "screened",
  "shortlisted",
  "interview",
  "offered",
  "hired",
];

const MS_DAY = 24 * 60 * 60 * 1000;

const normalizeStatus = (status) => {
  if (status === "sent" || status === "pending") return "applied";
  if (status === "accepted") return "shortlisted";
  if (status === "rejected") return "rejected";
  if (PIPELINE.includes(status)) return status;
  return "applied";
};

const emptyFunnel = () => ({
  applied: 0,
  screened: 0,
  shortlisted: 0,
  interview: 0,
  offered: 0,
  hired: 0,
  rejected: 0,
});

const parseRange = (key) => {
  const now = new Date();
  const to = now;
  if (key === "7d") {
    return { key: "7d", from: new Date(now.getTime() - 7 * MS_DAY), to, days: 7 };
  }
  if (key === "30d") {
    return { key: "30d", from: new Date(now.getTime() - 30 * MS_DAY), to, days: 30 };
  }
  return { key: "all", from: null, to, days: 30 };
};

const startOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay(); // 0 Sun
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + diff);
  return d;
};

const endOfWeek = (weekStart) => {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 7);
  return d;
};

/**
 * GET /api/jobs/analytics?range=7d|30d|all&workspaceId=
 */
export const getEmployerAnalytics = async (req, res) => {
  try {
    const home = await getOrCreateHomeWorkspace(req.user);
    const requestedWorkspaceId = String(
      req.query.workspaceId || req.get("X-Workspace-Id") || ""
    ).trim();

    const workspaceId = requestedWorkspaceId || String(home._id);
    if (workspaceId !== String(home._id)) {
      // Home-workspace only for MVP (Team roles later)
      return res.status(403).json({
        success: false,
        message: "Workspace access denied",
      });
    }

    const rangeKey = String(req.query.range || "30d").trim();
    const range = parseRange(
      rangeKey === "7d" || rangeKey === "all" ? rangeKey : "30d"
    );

    const jobs = await Job.find({
      postedBy: req.userId,
      workspaceId: String(workspaceId),
    })
      .select("_id title status createdAt applicants")
      .lean();

    const jobIds = jobs.map((j) => j._id);
    const jobMap = new Map(jobs.map((j) => [String(j._id), j]));

    const appFilter = { jobId: { $in: jobIds } };
    if (range.from) {
      appFilter.appliedAt = { $gte: range.from, $lte: range.to };
    }

    const applications = jobIds.length
      ? await Application.find(appFilter)
          .select("jobId status appliedAt")
          .lean()
      : [];

    // Prior window for delta (same length as current, when not "all")
    let prevApplicants = 0;
    if (range.from && range.key !== "all") {
      const span = range.to.getTime() - range.from.getTime();
      const prevFrom = new Date(range.from.getTime() - span);
      const prevTo = range.from;
      prevApplicants = await Application.countDocuments({
        jobId: { $in: jobIds },
        appliedAt: { $gte: prevFrom, $lt: prevTo },
      });
    }

    const funnel = emptyFunnel();
    const byJobCounts = new Map(); // jobId -> { total, hired, interview, rejected }

    for (const app of applications) {
      const stage = normalizeStatus(app.status);
      if (funnel[stage] !== undefined) funnel[stage] += 1;

      const jid = String(app.jobId);
      if (!byJobCounts.has(jid)) {
        byJobCounts.set(jid, { total: 0, hired: 0, interview: 0, rejected: 0 });
      }
      const row = byJobCounts.get(jid);
      row.total += 1;
      if (stage === "hired") row.hired += 1;
      if (stage === "interview" || stage === "offered" || stage === "hired") {
        row.interview += 1;
      }
      if (stage === "rejected") row.rejected += 1;
    }

    const applicants = applications.length;
    const applicantsDelta =
      range.key === "all" ? 0 : applicants - prevApplicants;

    const needsAction = funnel.applied + funnel.screened;
    const activeJobs = jobs.filter((j) => j.status === "active").length;

    // Avg days in queue for applied+screened (using appliedAt vs now)
    const queueApps = applications.filter((a) => {
      const s = normalizeStatus(a.status);
      return s === "applied" || s === "screened";
    });
    let avgQueueDays = null;
    if (queueApps.length > 0) {
      const sum = queueApps.reduce((acc, a) => {
        const t = new Date(a.appliedAt).getTime();
        if (!Number.isFinite(t)) return acc;
        return acc + (Date.now() - t) / MS_DAY;
      }, 0);
      avgQueueDays = Math.round((sum / queueApps.length) * 10) / 10;
    }

    const weekStart = startOfWeek(new Date());
    const weekEnd = endOfWeek(weekStart);
    const interviewsThisWeek = await Interview.countDocuments({
      organizerId: req.userId,
      workspaceId: String(workspaceId),
      status: { $in: ["scheduled", "rescheduled"] },
      startsAt: { $gte: weekStart, $lt: weekEnd },
    });

    const byJob = jobs
      .map((job) => {
        const id = String(job._id);
        const counts = byJobCounts.get(id) || {
          total: 0,
          hired: 0,
          interview: 0,
          rejected: 0,
        };
        const openDays = job.createdAt
          ? Math.max(
              0,
              Math.floor((Date.now() - new Date(job.createdAt).getTime()) / MS_DAY)
            )
          : 0;
        const conversionPct =
          counts.total > 0
            ? Math.round((counts.interview / counts.total) * 1000) / 10
            : 0;
        const hirePct =
          counts.total > 0
            ? Math.round((counts.hired / counts.total) * 1000) / 10
            : 0;
        return {
          jobId: id,
          title: job.title || "Untitled",
          status: job.status,
          applicants: counts.total,
          reachedInterview: counts.interview,
          hired: counts.hired,
          rejected: counts.rejected,
          conversionPct,
          hirePct,
          openDays,
        };
      })
      .sort((a, b) => b.applicants - a.applicants);

    // Daily series for chart (last `days` days, or last 30 when all)
    const seriesDays = range.key === "all" ? 30 : range.days;
    const seriesFrom = new Date(Date.now() - seriesDays * MS_DAY);
    seriesFrom.setHours(0, 0, 0, 0);

    const seriesApps =
      jobIds.length === 0
        ? []
        : await Application.find({
            jobId: { $in: jobIds },
            appliedAt: { $gte: seriesFrom },
          })
            .select("appliedAt")
            .lean();

    const dayBuckets = new Map();
    for (let i = 0; i < seriesDays; i++) {
      const d = new Date(seriesFrom.getTime() + i * MS_DAY);
      const key = d.toISOString().slice(0, 10);
      dayBuckets.set(key, 0);
    }
    for (const app of seriesApps) {
      const key = new Date(app.appliedAt).toISOString().slice(0, 10);
      if (dayBuckets.has(key)) {
        dayBuckets.set(key, dayBuckets.get(key) + 1);
      }
    }
    const series = {
      days: [...dayBuckets.keys()],
      applicants: [...dayBuckets.values()],
    };

    const conversionToInterview =
      applicants > 0
        ? Math.round(
            ((funnel.interview + funnel.offered + funnel.hired) / applicants) * 1000
          ) / 10
        : 0;
    const conversionToHire =
      applicants > 0
        ? Math.round((funnel.hired / applicants) * 1000) / 10
        : 0;

    return res.status(200).json({
      success: true,
      range: {
        key: range.key,
        from: range.from ? range.from.toISOString() : null,
        to: range.to.toISOString(),
      },
      kpis: {
        activeJobs,
        totalJobs: jobs.length,
        applicants,
        applicantsDelta,
        needsAction,
        interviewsThisWeek,
        hired: funnel.hired,
        rejected: funnel.rejected,
        avgQueueDays,
        conversionToInterview,
        conversionToHire,
      },
      funnel,
      byJob,
      series,
    });
  } catch (error) {
    if (error instanceof WorkspaceAccessError) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    console.error("Employer analytics error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Could not load analytics",
    });
  }
};
