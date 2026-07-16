const getBaseUrl = () => {
  const url = process.env.JOB_MANAGEMENT_BASE_URL?.trim().replace(/\/$/, "");
  if (!url) {
    throw new Error("JOB_MANAGEMENT_BASE_URL is not configured");
  }
  return url;
};

/**
 * Fetch a single application from job-management.
 * Forwards the caller's Authorization header so job-management can enforce
 * that only the job owner or the applicant may read it.
 *
 * Returns { ok: true, application } or { ok: false, status, message }.
 */
export const fetchApplication = async (applicationId, authorizationHeader) => {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return {
      ok: false,
      status: 401,
      message: "No token provided. Please login.",
    };
  }

  try {
    const response = await fetch(
      `${getBaseUrl()}/api/jobs/applications/${applicationId}`,
      {
        method: "GET",
        headers: {
          Authorization: authorizationHeader,
        },
      }
    );

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
        message: data.message || "Could not verify application",
      };
    }

    if (!data.application?.id) {
      return {
        ok: false,
        status: 502,
        message: "Invalid application response from job management service",
      };
    }

    return {
      ok: true,
      application: data.application,
    };
  } catch (error) {
    console.error("Job management client error:", error.message);
    return {
      ok: false,
      status: 503,
      message: "Job management service unavailable",
    };
  }
};
