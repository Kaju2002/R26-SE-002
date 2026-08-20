const getBaseUrl = () => {
  const url = process.env.USER_MANAGEMENT_BASE_URL?.trim().replace(/\/$/, "");
  if (!url) {
    throw new Error("USER_MANAGEMENT_BASE_URL is not configured");
  }
  return url;
};

/**
 * Validate session by calling user-management GET /api/auth/me.
 */
export const validateUserSession = async (authorizationHeader) => {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return {
      ok: false,
      status: 401,
      message: "No token provided. Please login.",
    };
  }

  try {
    const response = await fetch(`${getBaseUrl()}/api/auth/me`, {
      method: "GET",
      headers: {
        Authorization: authorizationHeader,
      },
    });

    let data = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: data.message || "Authentication failed",
      };
    }

    if (!data.user?.id) {
      return {
        ok: false,
        status: 502,
        message: "Invalid auth response from user management service",
      };
    }

    return {
      ok: true,
      user: data.user,
    };
  } catch (error) {
    console.error("User management auth validation error:", error.message);
    return {
      ok: false,
      status: 503,
      message: "User management service unavailable",
    };
  }
};

/**
 * Find jobseekers whose profile skills overlap the given job skills.
 */
export const findJobseekersMatchingSkills = async (
  skills = [],
  { excludeUserId, limit = 100 } = {}
) => {
  const key = process.env.INTERNAL_SERVICE_KEY?.trim();
  if (!key) {
    console.warn(
      "Notification service: INTERNAL_SERVICE_KEY missing; skill-match lookup skipped"
    );
    return [];
  }

  const response = await fetch(
    `${getBaseUrl()}/api/internal/jobseekers/match-skills`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-service-key": key,
      },
      body: JSON.stringify({
        skills,
        excludeUserId,
        limit,
      }),
    }
  );

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      data.message || `Skill match lookup failed (${response.status})`
    );
  }

  return Array.isArray(data.users) ? data.users : [];
};

/**
 * List active superadmin accounts for moderation notifications.
 */
export const listSuperadmins = async () => {
  const key = process.env.INTERNAL_SERVICE_KEY?.trim();
  if (!key) {
    console.warn(
      "Notification service: INTERNAL_SERVICE_KEY missing; superadmin lookup skipped"
    );
    return [];
  }

  const response = await fetch(`${getBaseUrl()}/api/internal/superadmins`, {
    method: "GET",
    headers: {
      "x-internal-service-key": key,
    },
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      data.message || `Superadmin lookup failed (${response.status})`
    );
  }

  return Array.isArray(data.users) ? data.users : [];
};
