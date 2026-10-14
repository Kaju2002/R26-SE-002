const TEXT_TIMEOUT_MS = 15000;
// OCR on CPU can take several seconds on large screenshots.
const IMAGE_TIMEOUT_MS = 60000;

const getBaseUrl = () => {
  const url = process.env.SCAM_DETECTION_BASE_URL?.trim().replace(/\/$/, "");
  if (!url) {
    throw new Error("SCAM_DETECTION_BASE_URL is not configured");
  }
  return url;
};

const internalHeaders = () => {
  const key = process.env.INTERNAL_SERVICE_KEY?.trim();
  if (!key) {
    throw new Error("INTERNAL_SERVICE_KEY is not configured");
  }
  return { "x-internal-service-key": key };
};

const emptyAnalysis = (status, analyzedAt = null) => ({
  status,
  isScam: false,
  score: null,
  tactics: [],
  analyzedAt,
});

/** Map a scam-detection ClassifyResponse to Message.scamAnalysis. */
export const toScamAnalysis = (data, analyzedAt = new Date()) => {
  const isScam = Boolean(data?.is_scam);
  const suspicious =
    !isScam && (data?.label === "SUSPICIOUS" || data?.inconclusive === true);
  const confidence =
    typeof data?.confidence === "number" ? data.confidence : null;
  // API returns confidence 0–100; our schema stores score 0–1.
  const score =
    confidence === null ? null : Math.min(1, Math.max(0, confidence / 100));

  const tactics = Array.isArray(data?.tactics)
    ? data.tactics
        .map((t) => t?.key || t?.name)
        .filter(Boolean)
        .map(String)
    : [];

  return {
    status: isScam ? "flagged" : suspicious ? "suspicious" : "safe",
    isScam,
    score,
    tactics,
    analyzedAt,
  };
};

const readJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

const postWithTimeout = async (path, init, timeoutMs) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${getBaseUrl()}${path}`, {
      ...init,
      method: "POST",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
};

/**
 * Call scam-detection FastAPI POST /classify as a trusted service.
 * Results are stored on the chat message only (never in a user's scan history).
 *
 * Returns a Message.scamAnalysis-shaped object:
 *   { status, isScam, score, tactics, analyzedAt }
 *
 * Never throws for "service down" — returns status: "error" so chat still works.
 */
export const analyzeMessageForScam = async (text) => {
  const analyzedAt = new Date();
  const truncated = String(text || "").trim().slice(0, 2000);

  if (!truncated) {
    return emptyAnalysis("not_checked");
  }

  try {
    const response = await postWithTimeout(
      "/classify",
      {
        headers: { "Content-Type": "application/json", ...internalHeaders() },
        body: JSON.stringify({ text: truncated }),
      },
      TEXT_TIMEOUT_MS
    );
    const data = await readJson(response);

    if (!response.ok) {
      console.error(
        "Scam detection classify failed:",
        response.status,
        data.detail || data.message || "",
        `(url: ${getBaseUrl()}/classify)`
      );
      return emptyAnalysis("error", analyzedAt);
    }

    return toScamAnalysis(data, analyzedAt);
  } catch (error) {
    console.error("Scam detection client error:", error.message);
    return emptyAnalysis("error", analyzedAt);
  }
};

/**
 * OCR + classify an image attachment via POST /classify-image.
 * Images without readable text return status "not_checked".
 */
export const analyzeImageForScam = async (buffer, { mimeType, fileName } = {}) => {
  const analyzedAt = new Date();
  if (!buffer?.length) {
    return emptyAnalysis("not_checked");
  }

  try {
    const form = new FormData();
    form.append(
      "file",
      new Blob([buffer], { type: mimeType || "application/octet-stream" }),
      fileName || "chat-image"
    );

    const response = await postWithTimeout(
      "/classify-image",
      { headers: internalHeaders(), body: form },
      IMAGE_TIMEOUT_MS
    );
    const data = await readJson(response);

    if (!response.ok) {
      // 400 = OCR found no text; 415 = format the OCR pipeline does not read (e.g. GIF).
      if (response.status === 400 || response.status === 415) {
        return emptyAnalysis("not_checked", analyzedAt);
      }
      console.error(
        "Scam detection classify-image failed:",
        response.status,
        data.detail || data.message || ""
      );
      return emptyAnalysis("error", analyzedAt);
    }

    return toScamAnalysis(data, analyzedAt);
  } catch (error) {
    console.error("Scam detection image client error:", error.message);
    return emptyAnalysis("error", analyzedAt);
  }
};
