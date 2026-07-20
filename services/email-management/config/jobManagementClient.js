const getBaseUrl = () => {
  const url = process.env.JOB_MANAGEMENT_BASE_URL?.trim().replace(/\/$/, "");
  if (!url) {
    throw new Error("JOB_MANAGEMENT_BASE_URL is not configured");
  }
  return url;
};

export const getApplicationForSender = async (authorizationHeader, applicationId) => {
  const response = await fetch(
    `${getBaseUrl()}/api/jobs/applications/${encodeURIComponent(applicationId)}`,
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
      message: data.message || "Could not verify application ownership",
    };
  }

  return {
    ok: true,
    application: data.application,
  };
};
