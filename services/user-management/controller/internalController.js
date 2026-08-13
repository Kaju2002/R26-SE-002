import User from "../model/userModel.js";

const normalize = (skills = []) =>
  skills
    .map((s) => String(s || "").trim().toLowerCase())
    .filter(Boolean);

const skillOverlaps = (userSkill, jobSkill) =>
  userSkill.includes(jobSkill) || jobSkill.includes(userSkill);

/**
 * Internal: find jobseekers whose profile skills overlap the job skills.
 * Protected by x-internal-service-key.
 */
export const matchJobseekersBySkills = async (req, res) => {
  try {
    const expected = process.env.INTERNAL_SERVICE_KEY?.trim();
    const provided = String(req.headers["x-internal-service-key"] || "").trim();

    if (!expected || provided !== expected) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized internal request",
      });
    }

    const jobSkills = normalize(
      Array.isArray(req.body?.skills) ? req.body.skills : []
    );
    if (!jobSkills.length) {
      return res.status(200).json({
        success: true,
        message: "No skills to match",
        users: [],
      });
    }

    const excludeUserId = req.body?.excludeUserId
      ? String(req.body.excludeUserId).trim()
      : "";
    const limit = Math.min(
      Math.max(Number(req.body?.limit) || 100, 1),
      500
    );

    const filter = {
      accountType: "jobseeker",
      skills: { $exists: true, $type: "array", $ne: [] },
    };
    if (excludeUserId && /^[a-fA-F0-9]{24}$/.test(excludeUserId)) {
      filter._id = { $ne: excludeUserId };
    }

    const candidates = await User.find(filter)
      .select("_id skills")
      .limit(Math.max(limit * 3, 150))
      .lean();

    const users = [];
    for (const user of candidates) {
      const userSkills = normalize(user.skills);
      if (!userSkills.length) continue;

      const matchedSkills = [];
      for (const jobSkill of jobSkills) {
        for (const userSkill of userSkills) {
          if (skillOverlaps(userSkill, jobSkill)) {
            // Prefer original casing from profile when possible
            const original =
              (user.skills || []).find(
                (s) => String(s).trim().toLowerCase() === userSkill
              ) || userSkill;
            if (!matchedSkills.includes(original)) {
              matchedSkills.push(original);
            }
            break;
          }
        }
      }

      if (matchedSkills.length === 0) continue;

      users.push({
        id: String(user._id),
        matchedSkills,
      });

      if (users.length >= limit) break;
    }

    return res.status(200).json({
      success: true,
      message: "Skill matches fetched",
      users,
    });
  } catch (error) {
    console.error("matchJobseekersBySkills error:", error);
    return res.status(500).json({
      success: false,
      message: "Error matching jobseekers by skills",
      error: error.message,
    });
  }
};
