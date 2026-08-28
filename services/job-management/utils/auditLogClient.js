const getBaseUrl = () =>
  process.env.USER_MANAGEMENT_BASE_URL?.trim().replace(/\/$/, "") || "";

const getInternalKey = () => process.env.INTERNAL_SERVICE_KEY?.trim() || "";

const buildActorFromRequest = (req) => {
  const user = req.user || {};
  const name =
    String(user.fullName || "").trim() ||
    `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
    user.email ||
    "Admin";

  return {
    actorId: String(req.userId || user.id || ""),
    actorName: name,
    actorEmail: String(user.email || req.userEmail || ""),
  };
};

/**
 * Record an admin audit log entry via user-management internal API.
 * Never throws — audit failures must not block admin actions.
 */
export const recordAuditLog = async (req, entry) => {
  const baseUrl = getBaseUrl();
  const key = getInternalKey();
  if (!baseUrl || !key) {
    console.warn("job-management: audit log skipped (missing USER_MANAGEMENT_BASE_URL or INTERNAL_SERVICE_KEY)");
    return false;
  }

  const actor = buildActorFromRequest(req);
  if (!actor.actorId) {
    console.warn("job-management: audit log skipped (missing actor id)");
    return false;
  }

  try {
    const response = await fetch(`${baseUrl}/api/internal/audit-log`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-service-key": key,
      },
      body: JSON.stringify({
        ...actor,
        ...entry,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      console.warn(
        "job-management: audit log request failed:",
        data.message || response.status
      );
      return false;
    }

    return true;
  } catch (error) {
    console.warn("job-management: audit log request error:", error.message);
    return false;
  }
};
