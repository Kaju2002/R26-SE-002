const getBaseUrl = () => {
  const url = process.env.SCAM_DETECTION_BASE_URL?.trim().replace(/\/$/, "");
  if (!url) {
    throw new Error("SCAM_DETECTION_BASE_URL is not configured");
  }
  return url;
};

/**
 * Call scam-detection FastAPI POST /classify.
 *
 * Returns a Message.scamAnalysis-shaped object:
 *   { status, isScam, score, tactics, analyzedAt }
 *
 * Never throws for "service down" — returns status: "error" so chat still works.
 */
export const analyzeMessageForScam = async (text, userId) => {
  const analyzedAt = new Date();
  const truncated = String(text || "").trim().slice(0, 2000);

  if (!truncated) {
    return {
      status: "not_checked",
      isScam: false,
      score: null,
      tactics: [],
      analyzedAt: null,
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(`${getBaseUrl()}/classify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: truncated,
        user_id: String(userId),
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    let data = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      console.error(
        "Scam detection classify failed:",
        response.status,
        data.detail || data.message || "",
        `(url: ${getBaseUrl()}/classify)`
      );
      return {
        status: "error",
        isScam: false,
        score: null,
        tactics: [],
        analyzedAt,
      };
    }

    const isScam = Boolean(data.is_scam);
    const confidence =
      typeof data.confidence === "number" ? data.confidence : null;
    // API returns confidence 0–100; our schema stores score 0–1.
    const score =
      confidence === null
        ? null
        : Math.min(1, Math.max(0, confidence / 100));

    const tactics = Array.isArray(data.tactics)
      ? data.tactics
          .map((t) => t?.key || t?.name)
          .filter(Boolean)
          .map(String)
      : [];

    return {
      status: isScam ? "flagged" : "safe",
      isScam,
      score,
      tactics,
      analyzedAt,
    };
  } catch (error) {
    console.error("Scam detection client error:", error.message);
    return {
      status: "error",
      isScam: false,
      score: null,
      tactics: [],
      analyzedAt,
    };
  }
};
