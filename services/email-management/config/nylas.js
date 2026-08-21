const getApiUri = () =>
  (process.env.NYLAS_API_URI?.trim() || "https://api.us.nylas.com").replace(
    /\/$/,
    ""
  );

export const getNylasConfig = () => {
  const clientId = process.env.NYLAS_CLIENT_ID?.trim();
  const apiKey = process.env.NYLAS_API_KEY?.trim();
  const redirectUri = process.env.NYLAS_REDIRECT_URI?.trim();

  if (!clientId) {
    throw new Error("NYLAS_CLIENT_ID is not configured");
  }
  if (!apiKey) {
    throw new Error("NYLAS_API_KEY is not configured");
  }
  if (!redirectUri) {
    throw new Error("NYLAS_REDIRECT_URI is not configured");
  }

  return {
    clientId,
    apiKey,
    redirectUri,
    apiUri: getApiUri(),
  };
};

export const buildOAuthUrl = ({
  clientId,
  redirectUri,
  provider,
  loginHint,
  state,
  apiUri,
}) => {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    provider,
    state,
  });

  if (loginHint) {
    params.set("login_hint", loginHint);
  }

  const authHost = (apiUri || getApiUri()).replace(/\/$/, "");
  return `${authHost}/v3/connect/auth?${params.toString()}`;
};

export const exchangeCodeForToken = async ({
  clientId,
  apiKey,
  redirectUri,
  code,
  apiUri,
}) => {
  const response = await fetch(`${apiUri}/v3/connect/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: apiKey,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      data?.error_description ||
      data?.message ||
      data?.error ||
      "Failed to exchange Nylas authorization code";
    throw new Error(message);
  }

  return data;
};

export const sendMessage = async ({ apiKey, apiUri, grantId, to, subject, body }) => {
  const response = await fetch(`${apiUri}/v3/grants/${grantId}/messages/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      to: [{ email: to }],
      subject,
      body,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      data?.error_description ||
      data?.message ||
      data?.error ||
      "Failed to send email via Nylas";
    throw new Error(message);
  }

  return data;
};

export const revokeGrant = async ({ apiKey, apiUri, grantId }) => {
  const response = await fetch(`${apiUri}/v3/grants/${grantId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok && response.status !== 404) {
    const data = await response.json().catch(() => ({}));
    const message =
      data?.error_description ||
      data?.message ||
      data?.error ||
      "Failed to revoke Nylas grant";
    throw new Error(message);
  }
};

const nylasErrorMessage = (data, fallback) =>
  data?.error_description || data?.message || data?.error || fallback;

export const listFolders = async ({ apiKey, apiUri, grantId }) => {
  const response = await fetch(`${apiUri}/v3/grants/${grantId}/folders`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(nylasErrorMessage(data, "Failed to list folders"));
  }

  return Array.isArray(data.data) ? data.data : [];
};

export const listMessages = async ({
  apiKey,
  apiUri,
  grantId,
  in: folderId,
  limit = 50,
  searchQueryNative,
  pageToken,
}) => {
  const params = new URLSearchParams({
    limit: String(Math.min(Math.max(Number(limit) || 50, 1), 100)),
  });

  if (folderId) {
    params.set("in", folderId);
  }
  if (searchQueryNative) {
    params.set("search_query_native", searchQueryNative);
  }
  if (pageToken) {
    params.set("page_token", pageToken);
  }

  const response = await fetch(
    `${apiUri}/v3/grants/${grantId}/messages?${params.toString()}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    }
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(nylasErrorMessage(data, "Failed to list messages"));
  }

  return {
    messages: Array.isArray(data.data) ? data.data : [],
    nextCursor: data.next_cursor || data.nextCursor || null,
  };
};

export const getMessage = async ({ apiKey, apiUri, grantId, messageId }) => {
  const response = await fetch(
    `${apiUri}/v3/grants/${grantId}/messages/${encodeURIComponent(messageId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    }
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(nylasErrorMessage(data, "Failed to fetch message"));
  }

  return data.data || data;
};

/**
 * Create a calendar event (Nylas v3). Use calendar_id=primary for the default calendar.
 * conferencing.provider: "Google Meet" | "Microsoft Teams" | "Zoom Meeting"
 */
export const createEvent = async ({
  apiKey,
  apiUri,
  grantId,
  calendarId = "primary",
  title,
  description,
  location,
  startTime,
  endTime,
  timezone = "UTC",
  participants = [],
  conferencingProvider,
  busy = true,
}) => {
  const body = {
    title,
    description: description || undefined,
    location: location || undefined,
    busy,
    participants: (Array.isArray(participants) ? participants : [])
      .filter((p) => p?.email)
      .map((p) => ({
        email: String(p.email).trim(),
        name: p.name ? String(p.name).trim() : undefined,
      })),
    when: {
      start_time: Math.floor(Number(startTime)),
      end_time: Math.floor(Number(endTime)),
      start_timezone: timezone,
      end_timezone: timezone,
    },
  };

  if (conferencingProvider) {
    body.conferencing = {
      provider: conferencingProvider,
      autocreate: {},
    };
  }

  const params = new URLSearchParams({
    calendar_id: calendarId || "primary",
    notify_participants: "true",
  });

  const response = await fetch(
    `${apiUri}/v3/grants/${grantId}/events?${params.toString()}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(nylasErrorMessage(data, "Failed to create calendar event"));
  }

  return data.data || data;
};

export const deleteEvent = async ({
  apiKey,
  apiUri,
  grantId,
  eventId,
  calendarId = "primary",
}) => {
  const params = new URLSearchParams({
    calendar_id: calendarId || "primary",
    notify_participants: "true",
  });

  const response = await fetch(
    `${apiUri}/v3/grants/${grantId}/events/${encodeURIComponent(eventId)}?${params.toString()}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    }
  );

  if (!response.ok && response.status !== 404) {
    const data = await response.json().catch(() => ({}));
    throw new Error(nylasErrorMessage(data, "Failed to delete calendar event"));
  }
};

/** Update event time (and optional fields). Nylas v3 PUT. */
export const updateEvent = async ({
  apiKey,
  apiUri,
  grantId,
  eventId,
  calendarId = "primary",
  title,
  description,
  location,
  startTime,
  endTime,
  timezone = "UTC",
}) => {
  const body = {};
  if (title !== undefined) body.title = title;
  if (description !== undefined) body.description = description;
  if (location !== undefined) body.location = location;
  if (startTime != null && endTime != null) {
    body.when = {
      start_time: Math.floor(Number(startTime)),
      end_time: Math.floor(Number(endTime)),
      start_timezone: timezone,
      end_timezone: timezone,
    };
  }

  const params = new URLSearchParams({
    calendar_id: calendarId || "primary",
    notify_participants: "true",
  });

  const response = await fetch(
    `${apiUri}/v3/grants/${grantId}/events/${encodeURIComponent(eventId)}?${params.toString()}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(nylasErrorMessage(data, "Failed to update calendar event"));
  }

  return data.data || data;
};
