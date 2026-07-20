const getBaseUrl = () => {
  const url = process.env.USER_MANAGEMENT_BASE_URL?.trim().replace(/\/$/, "");
  if (!url) {
    throw new Error("USER_MANAGEMENT_BASE_URL is not configured");
  }
  return url;
};

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

export const getNylasGrant = async (authorizationHeader) => {
  const response = await fetch(`${getBaseUrl()}/api/auth/nylas`, {
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
      message: data.message || "Could not load Nylas grant",
    };
  }

  return {
    ok: true,
    connected: Boolean(data.connected),
    grantId: data.grantId || null,
    email: data.email || null,
    connectedAt: data.connectedAt || null,
  };
};

export const saveNylasGrant = async (authorizationHeader, { grantId, email }) => {
  const response = await fetch(`${getBaseUrl()}/api/auth/nylas`, {
    method: "PATCH",
    headers: {
      Authorization: authorizationHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ grantId, email }),
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
      message: data.message || "Could not save Nylas grant",
    };
  }

  return { ok: true, user: data.user };
};

export const clearNylasGrant = async (authorizationHeader) => {
  const response = await fetch(`${getBaseUrl()}/api/auth/nylas`, {
    method: "PATCH",
    headers: {
      Authorization: authorizationHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ clear: true }),
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
      message: data.message || "Could not clear Nylas grant",
    };
  }

  return { ok: true };
};
