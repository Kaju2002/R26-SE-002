const DEFAULT_BASE_URL = "http://127.0.0.1:8003";
const TEXT_TIMEOUT_MS = 20000;
const IMAGE_TIMEOUT_MS = 90000;
const EXPLAIN_TIMEOUT_MS = 60000;

const getBaseUrl = () =>
  process.env.FAKE_JOB_API_BASE_URL?.trim().replace(/\/$/, "") || DEFAULT_BASE_URL;

const emptyHighlights = () => ({ lime: [], shap: [] });

const parseHighlights = (items) => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      const token = String(item?.token || "").trim();
      const weight = Number(item?.weight);
      if (!token || !Number.isFinite(weight)) return null;
      const toward =
        item?.toward === "legitimate" || weight < 0 ? "legitimate" : "fake";
      return { token, weight, toward };
    })
    .filter(Boolean)
    .slice(0, 12);
};

export const toRiskResult = (partial = {}) => ({
  prediction: String(partial.prediction || "error").toLowerCase(),
  fakeProbability:
    typeof partial.fakeProbability === "number" ? partial.fakeProbability : null,
  legitimateProbability:
    typeof partial.legitimateProbability === "number"
      ? partial.legitimateProbability
      : null,
  confidence: typeof partial.confidence === "number" ? partial.confidence : null,
  message: String(partial.message || "Fake-job check failed."),
  extractedText:
    typeof partial.extractedText === "string" ? partial.extractedText : "",
  lime: parseHighlights(partial.lime),
  shap: parseHighlights(partial.shap),
  checkedAt: new Date(),
});

const parseClassifyResponse = async (response) => {
  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }
  return data;
};

const fromApiData = (data) =>
  toRiskResult({
    prediction: data.prediction,
    fakeProbability:
      typeof data.fake_probability === "number" ? data.fake_probability : null,
    legitimateProbability:
      typeof data.legitimate_probability === "number"
        ? data.legitimate_probability
        : null,
    confidence: typeof data.confidence === "number" ? data.confidence : null,
    message: data.message,
    extractedText:
      typeof data.extracted_text === "string" ? data.extracted_text : "",
    lime: data.lime,
    shap: data.shap,
  });

const classifyUnavailable = (detail) =>
  toRiskResult({
    prediction: "error",
    message: `Fake-job detection unavailable (${detail}). Held for admin review.`,
  });

/**
 * Classify job-post text via fake-job-detection POST /predict-text.
 * Never throws — on outage returns prediction "error" so the listing is held.
 */
export const classifyJobPostText = async (text) => {
  const truncated = String(text || "").trim();
  if (truncated.length < 15) {
    return toRiskResult({
      prediction: "error",
      message: "Not enough job text to run fake-job detection.",
    });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TEXT_TIMEOUT_MS);

    const response = await fetch(`${getBaseUrl()}/predict-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: truncated.slice(0, 8000) }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const data = await parseClassifyResponse(response);

    if (!response.ok) {
      const detail = data.detail || data.message || `HTTP ${response.status}`;
      console.error("Fake-job text classify failed:", detail);
      return classifyUnavailable(detail);
    }

    return fromApiData(data);
  } catch (error) {
    console.error("Fake-job text client error:", error.message);
    return toRiskResult({
      prediction: "error",
      message: "Fake-job detection could not be reached. Held for admin review.",
    });
  }
};

const resolvePosterSource = ({ file, url } = {}) => {
  const imageUrl =
    (typeof url === "string" && url.trim()) ||
    file?.path ||
    file?.url ||
    null;
  return { file, imageUrl };
};

const loadPosterBytes = async (file, imageUrl) => {
  if (file?.buffer) {
    return {
      bytes: file.buffer,
      mime: file.mimetype || "image/jpeg",
      filename: file.originalname || "poster.jpg",
    };
  }

  if (!imageUrl) return null;

  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Could not download job poster (${response.status})`);
  }

  const mime = response.headers.get("content-type") || "image/jpeg";
  const bytes = Buffer.from(await response.arrayBuffer());
  return {
    bytes,
    mime: mime.split(";")[0].trim() || "image/jpeg",
    filename: "poster.jpg",
  };
};

/**
 * Classify job-poster image via fake-job-detection POST /predict (OCR + model).
 * Missing poster is skipped. Failures return prediction "error" so the listing is held.
 */
export const classifyJobPosterImage = async ({ file, url } = {}) => {
  const { file: posterFile, imageUrl } = resolvePosterSource({ file, url });
  if (!posterFile?.buffer && !imageUrl) {
    return toRiskResult({
      prediction: "skipped",
      message: "No job poster uploaded; image check skipped.",
    });
  }

  try {
    const source = await loadPosterBytes(posterFile, imageUrl);
    if (!source?.bytes?.length) {
      return toRiskResult({
        prediction: "error",
        message: "Job poster could not be read. Held for admin review.",
      });
    }

    const form = new FormData();
    form.append(
      "image",
      new Blob([new Uint8Array(source.bytes)], { type: source.mime }),
      source.filename
    );

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);

    const response = await fetch(`${getBaseUrl()}/predict`, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const data = await parseClassifyResponse(response);

    if (!response.ok) {
      const detail = data.detail || data.message || `HTTP ${response.status}`;
      console.error("Fake-job poster classify failed:", detail);
      return classifyUnavailable(detail);
    }

    return fromApiData(data);
  } catch (error) {
    console.error("Fake-job poster client error:", error.message);
    return toRiskResult({
      prediction: "error",
      message:
        "Job poster could not be checked. Held for admin review.",
    });
  }
};

/**
 * LIME + SHAP highlights for listing text. Never throws.
 */
export const explainJobPostText = async (text) => {
  const clipped = String(text || "").trim();
  if (clipped.length < 15) return emptyHighlights();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), EXPLAIN_TIMEOUT_MS);
    const response = await fetch(`${getBaseUrl()}/explain-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: clipped.slice(0, 8000) }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = await parseClassifyResponse(response);
    if (!response.ok) {
      console.error("Fake-job explain failed:", data.detail || response.status);
      return emptyHighlights();
    }
    return {
      lime: parseHighlights(data.lime),
      shap: parseHighlights(data.shap),
    };
  } catch (error) {
    console.error("Fake-job explain client error:", error.message);
    return emptyHighlights();
  }
};
