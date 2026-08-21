const getBaseUrl = () => {
  const url = process.env.EMAIL_MANAGEMENT_BASE_URL?.trim().replace(/\/$/, "");
  if (!url) {
    throw new Error("EMAIL_MANAGEMENT_BASE_URL is not configured");
  }
  return url;
};

async function parseJson(response) {
  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }
  return data;
}

/** Create Nylas calendar event (+ optional Meet/Teams) via email-management. */
export const createCalendarEvent = async (authorizationHeader, payload) => {
  const response = await fetch(`${getBaseUrl()}/api/email/calendar/events`, {
    method: "POST",
    headers: {
      Authorization: authorizationHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await parseJson(response);
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      message: data.message || "Could not create calendar event",
    };
  }

  return { ok: true, event: data.event };
};

export const deleteCalendarEvent = async (
  authorizationHeader,
  eventId,
  calendarId = "primary"
) => {
  const params = new URLSearchParams({ calendarId: calendarId || "primary" });
  const response = await fetch(
    `${getBaseUrl()}/api/email/calendar/events/${encodeURIComponent(eventId)}?${params}`,
    {
      method: "DELETE",
      headers: {
        Authorization: authorizationHeader,
      },
    }
  );

  const data = await parseJson(response);
  if (!response.ok && response.status !== 404) {
    return {
      ok: false,
      status: response.status,
      message: data.message || "Could not delete calendar event",
    };
  }

  return { ok: true };
};

export const updateCalendarEvent = async (authorizationHeader, eventId, payload) => {
  const response = await fetch(
    `${getBaseUrl()}/api/email/calendar/events/${encodeURIComponent(eventId)}`,
    {
      method: "PUT",
      headers: {
        Authorization: authorizationHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  const data = await parseJson(response);
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      message: data.message || "Could not update calendar event",
    };
  }

  return { ok: true, event: data.event };
};

export const sendInviteEmail = async (authorizationHeader, payload) => {
  const response = await fetch(`${getBaseUrl()}/api/email/send`, {
    method: "POST",
    headers: {
      Authorization: authorizationHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await parseJson(response);
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      message: data.message || "Could not send invite email",
    };
  }

  return { ok: true };
};
